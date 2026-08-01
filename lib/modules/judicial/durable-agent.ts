// ─────────────────────────────────────────────────────────────────────────────
// §25 — الوكيل القضائيّ الخلفيّ الدائم (Durable Judicial Agent)
//
// المهامّ عالية الأثر لا تُنجَز في نداءٍ واحد: تُدار عبر حالةٍ **قابلةٍ للحفظ والاستئناف**
// تتقدّم مرحلةً مرحلةً على مرورات الصياغة (§23) بنقاط تفتيشٍ (checkpoints). هذا المحرّك
// مُخفِّضٌ نقيّ (pure reducer) حتميّ: init ثمّ advance؛ الحالة قابلةٌ للتسلسل (JSON) لتُخزَّن
// في jds_agent_runs وتُستأنَف. لا يختلق تقدّمًا: المرحلة المفوَّضة تنتظر إفادةً من الخدمة.
// ─────────────────────────────────────────────────────────────────────────────
import { runDraftingPasses } from "./drafting-passes";
import type { DraftingPass, DraftingRunInput } from "./drafting-passes";

export type AgentRunStatus =
  | "INITIALIZED"
  | "RUNNING"
  | "AWAITING_DELEGATE" // بانتظار مخرَج توليدٍ من الخدمة لمرحلةٍ مفوَّضة
  | "BLOCKED" // متطلّبٌ ناقصٌ يوقف المتابعة حتى تُوفَّر (قابلٌ للاستئناف)
  | "READY_FOR_REVIEW" // اكتملت المراحل — بانتظار مراجعةٍ بشريّة
  | "COMPLETED"; // اعتُمِد بعد المراجعة (بإذنٍ صريح)

export interface AgentCheckpoint {
  step: number;
  passId: string;
  at: string; // طابعٌ زمنيّ يُمرَّر من الخدمة (لا يُولَّد هنا — حتميّة)
  note?: string;
}

export interface JudicialAgentRun {
  runId: string;
  taskId: string;
  status: AgentRunStatus;
  /** المرحلة الجارية (١‑مبنيّ)؛ 0 قبل البدء، length+1 بعد الاكتمال. */
  cursor: number;
  passes: DraftingPass[];
  completedSteps: number[];
  checkpoints: AgentCheckpoint[];
  blockedSteps: number[];
  /** المرحلة المفوَّضة المنتظِرة (إن كانت الحالة AWAITING_DELEGATE). */
  pendingDelegateStep: number | null;
  /** المرحلة المحجوزة المنتظِرة توفّر متطلّبها (إن كانت الحالة BLOCKED). */
  pendingBlockedStep: number | null;
}

export interface InitAgentRunInput extends DraftingRunInput {
  runId: string;
}

/** يهيّئ تشغيلًا دائمًا من مرورات §23 (بلا تقدّم بعد). */
export function initJudicialAgentRun(input: InitAgentRunInput): JudicialAgentRun {
  const run = runDraftingPasses(input);
  return {
    runId: input.runId,
    taskId: input.taskId,
    status: "INITIALIZED",
    cursor: 0,
    passes: run.passes,
    completedSteps: [],
    checkpoints: [],
    blockedSteps: run.blockedSteps,
    pendingDelegateStep: null,
    pendingBlockedStep: null,
  };
}

export interface AdvanceInput {
  /** طابعٌ زمنيّ للنقطة (يُمرَّر من الخدمة — لا يُولَّد داخليًّا). */
  at: string;
  /** إفادةٌ بإنجاز المرحلة المفوَّضة الحاليّة (نصّ التوليد جاهز) — تُخرِج من AWAITING_DELEGATE. */
  delegateFulfilled?: boolean;
  /** إفادةٌ بتوفّر المتطلّب المفقود للمرحلة المحجوزة — تُخرِج من BLOCKED. */
  requirementResolved?: boolean;
  /** ملاحظةٌ تُسجَّل مع نقطة التفتيش. */
  note?: string;
}

/**
 * §25 — يتقدّم خطوةً واحدة (مُخفِّضٌ نقيّ):
 *  - المرحلة المحجوزة (BLOCKED) توقف التقدّم عندها حتى يُرفع الحجز.
 *  - المرحلة المفوَّضة (DELEGATED) تدخل AWAITING_DELEGATE حتى delegateFulfilled.
 *  - المرحلة المنجَزة (DONE) تُختَم بنقطة تفتيشٍ ويتقدّم المؤشّر.
 *  - بعد آخر مرحلة ⇒ READY_FOR_REVIEW (لا COMPLETED إلا بإذنٍ صريحٍ عبر approveAgentRun).
 */
export function advanceJudicialAgentRun(run: JudicialAgentRun, input: AdvanceInput): JudicialAgentRun {
  if (run.status === "COMPLETED" || run.status === "READY_FOR_REVIEW") return run;

  // بانتظار مخرَج مرحلةٍ مفوَّضة: لا يتقدّم إلا بإفادة الإنجاز.
  if (run.status === "AWAITING_DELEGATE") {
    if (!input.delegateFulfilled) return run;
    return sealOrStep(run, run.pendingDelegateStep!, input.at, input.note);
  }

  // محجوزٌ على متطلّبٍ ناقص: لا يتقدّم إلا بإفادة توفّره (قابليّة الاستئناف §25).
  if (run.status === "BLOCKED") {
    if (!input.requirementResolved) return run;
    return sealOrStep(run, run.pendingBlockedStep!, input.at, input.note ?? "رُفع الحجز — توفّر المتطلّب");
  }

  const next = run.passes[run.cursor]; // المرحلة التالية (cursor صفريّ الفهرسة على المصفوفة)
  if (!next) return { ...run, status: "READY_FOR_REVIEW" };

  if (next.status === "BLOCKED") {
    return { ...run, status: "BLOCKED", pendingBlockedStep: next.step, blockedSteps: uniq([...run.blockedSteps, next.step]) };
  }
  if (next.status === "DELEGATED") {
    return { ...run, status: "AWAITING_DELEGATE", pendingDelegateStep: next.step };
  }
  // DONE / SKIPPED: تُختَم مباشرةً.
  return sealOrStep(run, next.step, input.at, input.note);
}

/** يختم مرحلةً ويتقدّم؛ إن كانت الأخيرة ⇒ READY_FOR_REVIEW، وإلا RUNNING. يُصفّر المؤشّرات المنتظِرة. */
function sealOrStep(run: JudicialAgentRun, step: number, at: string, note?: string): JudicialAgentRun {
  const cp = checkpoint(run, step, at, "RUNNING", note);
  return step === run.passes.length ? { ...cp, status: "READY_FOR_REVIEW" } : cp;
}

/** §26/§35 — الاعتماد النهائيّ لا يقع إلا بإذنٍ بشريٍّ صريح (لا آليًّا). */
export function approveJudicialAgentRun(run: JudicialAgentRun, approver: string, at: string): JudicialAgentRun {
  if (run.status !== "READY_FOR_REVIEW") return run;
  return {
    ...run,
    status: "COMPLETED",
    checkpoints: [...run.checkpoints, { step: run.passes.length, passId: "HUMAN_APPROVAL", at, note: `اعتمده: ${approver}` }],
  };
}

function checkpoint(run: JudicialAgentRun, step: number, at: string, status: AgentRunStatus, note?: string): JudicialAgentRun {
  const pass = run.passes[step - 1];
  return {
    ...run,
    status,
    cursor: step,
    completedSteps: uniq([...run.completedSteps, step]),
    checkpoints: [...run.checkpoints, { step, passId: pass?.id ?? `step${step}`, at, note }],
    pendingDelegateStep: null,
    pendingBlockedStep: null,
  };
}

function uniq(xs: number[]): number[] {
  return Array.from(new Set(xs)).sort((a, b) => a - b);
}

/** يُسلسِل الحالة للتخزين (jds_agent_runs). حتميّ — لا حقولٌ زمنيّةٌ داخليّة. */
export function serializeAgentRun(run: JudicialAgentRun): string {
  return JSON.stringify(run);
}

/** يستأنف من حالةٍ مخزَّنة. */
export function deserializeAgentRun(json: string): JudicialAgentRun {
  return JSON.parse(json) as JudicialAgentRun;
}
