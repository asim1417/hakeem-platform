// ─────────────────────────────────────────────────────────────────────────────
// §27/§31-I — مساعد الظلّ المشترك (Shared Shadow Review) — لكلّ الخدمات المنتِجة.
//
// أيّ خدمة (القاضي، الوكيل، المحاكاة، تحليل القضية، مشروع الحكم…) تستدعيه بعد التوليد
// فتُرفق مراجعة بوّابات JDS **الاسترشاديّة** بمخرجها — دون تغيير النصّ. يُرجِع undefined
// ما لم يُفعَّل JDS_DRAFTING_SHADOW (افتراض OFF ⇒ صفر تغيير). لا يرمي أبدًا (سقوطٌ آمن).
// ─────────────────────────────────────────────────────────────────────────────
import type { CourtTrack, DocumentFunction, JudicialRole, LitigationStage } from "./contracts";
import type { DraftStatement } from "./gate-executor";
import { getQualityGate } from "./quality-gates";
import { isJdsDraftingShadowEnabled, isJdsEnforceEnabled } from "./flag";
import { planJudicialTask, reviewJudicialDraft } from "./orchestrator";
import { traceStatements, unsupportedCount } from "./statement-trace";
import { runDraftingPasses } from "./drafting-passes";

/** شكل المراجعة المرفقة بمخرجات الخدمات (استرشاديّة في الظلّ، مُلزِمة في الوصل الفعّال). */
export interface JdsShadowReview {
  ready: boolean;
  blocking: string[];
  review: string[];
  findings: Array<{ gateId: string; outcome: string; findings: string[] }>;
  /** الوصل الفعّال (§27): مفعَّلٌ حين JDS_ENFORCE. */
  enforced: boolean;
  /** بلغ الاعتماد؟ في الإنفاذ = false حين توجد مخالفةٌ مانعة (يمنع الاعتماد). */
  releaseBlocked: boolean;
  /** إشعارٌ تصحيحيّ يُبرَز في المخرج حين الإنفاذ ووجود مخالفة (وإلا null). */
  banner: string | null;
  /** §22 — خلاصة تتبّع العبارات: إجماليّ العبارات وعدد غير المسنَد منها. */
  statementTrace: { total: number; unsupported: number };
  /** §23 — خلاصة مرورات الصياغة: العدد الكلّيّ والمفوَّض والمحجوز والجاهزيّة. */
  drafting: { total: number; delegated: number; blocked: number; readyForAssembly: boolean };
}

/** يبني الإشعار التصحيحيّ من البوّابات المانعة (بعناوينها العربيّة). */
function buildBanner(blocking: string[]): string {
  const titles = blocking.map((id) => getQualityGate(id)?.titleAr ?? id);
  return `⛔ مخالفاتٌ مانعة يجب تصحيحها قبل اعتماد هذا المخرج: ${titles.join("، ")}. (وصل JDS الفعّال — لا يُعتمَد حتى تُصحَّح)`;
}

export interface ShadowReviewInput {
  role: JudicialRole;
  documentFunction: DocumentFunction;
  litigationStage?: LitigationStage;
  courtTrack?: CourtTrack;
  subject?: string;
  draftText: string;
  requests?: string[];
  dispositionItems?: string[];
  objectionRoute?: "APPEAL" | "CASSATION" | "RECONSIDERATION";
  hasNonBindingLabel?: boolean;
  statements?: DraftStatement[];
  /** سياقٌ للإسناد (§22) — وقائع/أدلّة/سلطات معروفة تُثبَّت بها العبارات. */
  knownFacts?: string[];
  evidence?: string[];
  authorities?: string[];
  /** مستندات متاحة (§23) — لتقدير جاهزيّة مرورات الصياغة. */
  availableDocuments?: string[];
  lawAsOfDate?: string;
}

/** مراجعةٌ موحّدة — undefined ما لم يُفعَّل الظلّ أو الإنفاذ؛ لا ترمي. */
export function judicialShadowReview(input: ShadowReviewInput): JdsShadowReview | undefined {
  const enforce = isJdsEnforceEnabled();
  // الإنفاذ يُفعّل الظلّ ضمنًا؛ بلا أيّهما لا مراجعة.
  if (!isJdsDraftingShadowEnabled() && !enforce) return undefined;
  try {
    const plan = planJudicialTask({
      taskId: "shadow",
      role: input.role,
      documentFunction: input.documentFunction,
      litigationStage: input.litigationStage,
      courtTrack: input.courtTrack,
      text: input.subject,
    });
    const r = reviewJudicialDraft(plan, {
      draftText: input.draftText,
      requests: input.requests,
      dispositionItems: input.dispositionItems,
      objectionRoute: input.objectionRoute,
      hasNonBindingLabel: input.hasNonBindingLabel,
      statements: input.statements,
    });
    const releaseBlocked = enforce && r.blocking.length > 0;
    // §22 — تتبّع العبارات على النصّ المولَّد (استرشاديّ؛ لا يغيّر النصّ).
    const traces = traceStatements("shadow", input.draftText, {
      facts: input.knownFacts,
      evidence: input.evidence,
      authorities: input.authorities,
    });
    // §23 — مرورات الصياغة (خطّة المراحل الـ٢٢ وحالة الجاهزيّة).
    const run = runDraftingPasses({
      taskId: "shadow",
      role: input.role,
      documentFunction: input.documentFunction,
      litigationStage: input.litigationStage,
      courtTrack: input.courtTrack,
      text: input.subject,
      knownFacts: input.knownFacts,
      availableDocuments: input.availableDocuments,
      lawAsOfDate: input.lawAsOfDate,
    });
    return {
      ready: r.ready,
      blocking: r.blocking,
      review: r.review,
      findings: r.results.map((g) => ({ gateId: g.gateId, outcome: g.outcome, findings: g.findings })),
      enforced: enforce,
      releaseBlocked,
      banner: releaseBlocked ? buildBanner(r.blocking) : null,
      statementTrace: { total: traces.length, unsupported: unsupportedCount(traces) },
      drafting: {
        total: run.passes.length,
        delegated: run.delegatedSteps.length,
        blocked: run.blockedSteps.length,
        readyForAssembly: run.readyForAssembly,
      },
    };
  } catch {
    return undefined;
  }
}
