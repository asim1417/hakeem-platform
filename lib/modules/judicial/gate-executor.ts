// ─────────────────────────────────────────────────────────────────────────────
// §27 — محرّك تنفيذ بوّابات الجودة (Quality Gate Executor)
//
// يُشغّل البوّابات المنطبقة على مخرجٍ قضائيّ ويعيد QualityGateResult[]. مبدأ الصدق:
// **لا يُمرّر إلا ما يمكن التحقّق منه فعلًا من النصّ + النواة اللغويّة**؛ وما يحتاج بياناتٍ
// خارجيّة (اختصاص/سريان/مطابقة استشهاد) يُعلَّم NEEDS_REVIEW لا PASS (لا اجتيازٌ مُختلَق).
// نقيّ وحتميّ — قابل للاختبار بلا قاعدة/نموذج. تستدعيه كلّ خدمةٍ بعد التوليد.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  AssertionLevel,
  DocumentFunction,
  GateOutcome,
  JudicialVoiceProfile,
  QualityGateResult,
} from "./contracts";
import { blockingGatesFor } from "./quality-gates";
import { BENCH_ONLY_DECISIVE_TERMS, assertionViolations } from "./language-kernel";

export interface DraftStatement {
  text: string;
  assertionLevel: AssertionLevel;
}

export interface GateExecutionInput {
  documentFunction: DocumentFunction;
  voiceProfile: JudicialVoiceProfile;
  draftText: string;
  statements?: DraftStatement[];
  /** الطلبات مقابل بنود المنطوق (لفحص عدم التجاوز/الاتّساق JG15/JG16). */
  requests?: string[];
  dispositionItems?: string[];
  /** طريق الاعتراض المعلن (لفحص عدم الخلط JG14). */
  objectionRoute?: "APPEAL" | "CASSATION" | "RECONSIDERATION";
  /** هل وُسم المخرج بعدم الإلزام (JG19)؟ */
  hasNonBindingLabel?: boolean;
}

const OTHER_ROUTE_TERMS: Record<string, string[]> = {
  APPEAL: ["نقض", "التماس إعادة النظر"],
  CASSATION: ["استئناف", "التماس إعادة النظر"],
  RECONSIDERATION: ["استئناف", "نقض"],
};

/** يشغّل البوّابات المانعة المنطبقة، مُمرِّرًا ما يُتحقّق منه فقط. */
export function executeQualityGates(input: GateExecutionInput): QualityGateResult[] {
  const gates = blockingGatesFor(input.documentFunction);
  return gates.map((g) => runGate(g.id, input));
}

function result(gateId: string, outcome: GateOutcome, findings: string[] = []): QualityGateResult {
  return { gateId, outcome, findings };
}

function runGate(gateId: string, input: GateExecutionInput): QualityGateResult {
  switch (gateId) {
    case "JG13":
      return checkLanguageFidelity(input);
    case "JG14":
      return checkRouteTerminology(input);
    case "JG15":
      return checkNonUltraPetita(input);
    case "JG16":
      return checkReasoningDispositionConsistency(input);
    case "JG19":
      return checkNonBindingLabel(input);
    // بوّاباتٌ تتطلّب بياناتٍ خارجيّة (اختصاص/سريان/مطابقة استشهاد/خصوصيّة…): لا تُمرَّر آليًّا.
    default:
      return result(gateId, "NEEDS_REVIEW", ["تتطلّب تحقّقًا خارجيًّا/بشريًّا — لا تُجتاز آليًّا."]);
  }
}

// JG13 — أمانة اللغة القضائيّة: لا ألفاظ حسمٍ بصوت الطرف/الباحث، وضبط مستوى الجزم.
function checkLanguageFidelity(input: GateExecutionInput): QualityGateResult {
  const findings: string[] = [];
  if (input.voiceProfile !== "JUDICIAL_BENCH_RESTRICTED") {
    for (const t of BENCH_ONLY_DECISIVE_TERMS) {
      if (input.draftText.includes(t)) findings.push(`لفظ حسمٍ محكميّ «${t}» في صوتٍ غير المحكمة (خلط أصوات).`);
    }
  }
  for (const s of input.statements ?? []) {
    for (const v of assertionViolations(s.text, s.assertionLevel)) {
      findings.push(`لفظ «${v}» يتجاوز مستوى الجزم ${s.assertionLevel}.`);
    }
  }
  return result("JG13", findings.length ? "FAIL" : "PASS", findings);
}

// JG14 — مصطلح طريق الاعتراض: لا خلط بين الاستئناف والنقض والالتماس.
function checkRouteTerminology(input: GateExecutionInput): QualityGateResult {
  if (input.documentFunction !== "OBJECTION") return result("JG14", "NOT_APPLICABLE");
  if (!input.objectionRoute) return result("JG14", "NEEDS_REVIEW", ["لم يُحدَّد طريق الاعتراض."]);
  const foreign = OTHER_ROUTE_TERMS[input.objectionRoute] ?? [];
  const hits = foreign.filter((t) => input.draftText.includes(t));
  return result("JG14", hits.length ? "FAIL" : "PASS", hits.map((t) => `مصطلح طريقٍ آخر «${t}» في لائحة ${input.objectionRoute}.`));
}

// JG15 — عدم تجاوز الطلبات: كلّ بند منطوقٍ يقابله طلب.
function checkNonUltraPetita(input: GateExecutionInput): QualityGateResult {
  if (input.documentFunction !== "DISPOSITION") return result("JG15", "NOT_APPLICABLE");
  if (!input.requests || !input.dispositionItems) return result("JG15", "NEEDS_REVIEW", ["يلزم الطلبات وبنود المنطوق للفحص."]);
  const reqs = input.requests.map(norm);
  const extra = input.dispositionItems.filter((d) => !reqs.some((r) => norm(d).includes(r) || r.includes(norm(d))));
  return result("JG15", extra.length ? "FAIL" : "PASS", extra.map((d) => `بند منطوقٍ بلا طلبٍ مقابل (تجاوز): «${d}».`));
}

// JG16 — اتّساق الأسباب والمنطوق: كلّ طلبٍ له نتيجة.
function checkReasoningDispositionConsistency(input: GateExecutionInput): QualityGateResult {
  if (!input.requests || !input.dispositionItems) return result("JG16", "NEEDS_REVIEW", ["يلزم الطلبات وبنود المنطوق للفحص."]);
  const disp = input.dispositionItems.map(norm);
  const unanswered = input.requests.filter((r) => !disp.some((d) => d.includes(norm(r)) || norm(r).includes(d)));
  return result("JG16", unanswered.length ? "FAIL" : "PASS", unanswered.map((r) => `طلبٌ بلا نتيجةٍ في المنطوق: «${r}».`));
}

// JG19 — وسم عدم الإلزام لمخرجات صوت المحكمة.
function checkNonBindingLabel(input: GateExecutionInput): QualityGateResult {
  if (input.voiceProfile !== "JUDICIAL_BENCH_RESTRICTED") return result("JG19", "NOT_APPLICABLE");
  return input.hasNonBindingLabel
    ? result("JG19", "PASS")
    : result("JG19", "FAIL", ["مخرجٌ بصوت المحكمة بلا وسم «مسودّة داخليّة غير ملزمة»."]);
}

function norm(s: string): string {
  return s.replace(/[ًٌٍَُِّْ]/g, "").replace(/[إأآ]/g, "ا").replace(/\s+/g, " ").trim();
}

/** خلاصة: هل اجتاز المخرجُ كلَّ بوّابةٍ مانعةٍ منطبقة (لا FAIL)؟ NEEDS_REVIEW لا يمنع لكنّه يوقف عند READY_FOR_REVIEW. */
export function isReleaseReady(results: QualityGateResult[]): { ready: boolean; blocking: string[]; review: string[] } {
  const blocking = results.filter((r) => r.outcome === "FAIL").map((r) => r.gateId);
  const review = results.filter((r) => r.outcome === "NEEDS_REVIEW").map((r) => r.gateId);
  return { ready: blocking.length === 0, blocking, review };
}
