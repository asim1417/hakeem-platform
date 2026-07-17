// محرك المحاكاة القضائية (المرحلة الثامنة).
// يحاكي تفكير القاضي من القبول الشكلي حتى تقدير الحكم المحتمل، مُسنَداً وقابلاً للتتبّع.
// مسار: مدخلات → Case Analysis Engine → Legal Agent → Legal RAG → Citation Engine
//       → Judicial Simulation → رؤية قضائية مُحاكاة.
// لا يعدّل أيّاً من المراحل السابقة؛ يستدعيها فقط. كل المخرجات تدريبية لا حكم فعلي.
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { resolveAiProvider } from "@/lib/modules/ai/ai-provider";
import { buildLegalContextForAI } from "@/lib/modules/legal-core/legal-retrieval";
import { analyzeCase } from "@/lib/modules/case-analysis/case-analysis-engine";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import { runLegalAgent } from "@/lib/modules/legal-agent/legal-agent";
import type { LegalActionPlan } from "@/lib/modules/legal-agent/types";
import { buildJudicialSystemPrompt, buildJudicialUserPrompt } from "./judicial-prompts";
import { buildProceduralView } from "./procedural-stage";
import type { JudicialNarrative, JudicialSimulationInput, LitigationStage, SimulatedJudicialView } from "./types";

export const MIN_SIM_CONFIDENCE = 0.4;
export const TRAINING_DISCLAIMER =
  "هذه محاكاة قضائية تدريبية وتحليلية، وليست حكماً قضائياً فعلياً، ولا تُعرض بصيغة حكم نهائي ملزم.";
export const INSUFFICIENT_DISCLAIMER = "لا توجد مصادر أو معطيات كافية لمحاكاة قضائية موثوقة.";
export const PROBABILISTIC_TAG = "تقدير احتمالي يحتاج تحققاً من كامل ملف الدعوى.";

export async function runJudicialSimulation(input: JudicialSimulationInput): Promise<SimulatedJudicialView> {
  const stage: LitigationStage = input.litigationStage ?? "FIRST_INSTANCE";

  // 1) تحليل القضية (Case Analysis → Legal RAG → Citation Engine).
  let analysis: CaseAnalysisResult;
  try {
    analysis = await analyzeCase({
      facts: input.caseFacts,
      claims: input.claims,
      defenses: input.defenses,
      documents: input.documents,
      caseType: input.caseType,
    });
  } catch {
    analysis = fallbackAnalysis();
  }

  // 2) خطة الوكيل القانوني (تُبنى فوق التحليل والإسناد).
  let plan: LegalActionPlan | null = null;
  try {
    plan = await runLegalAgent({
      caseFacts: input.caseFacts,
      claims: input.claims,
      defenses: input.defenses,
      documents: input.documents,
      partyRole: input.partyRole,
      jurisdiction: input.jurisdiction,
      caseType: input.caseType,
    });
  } catch {
    plan = null;
  }

  // 3) تأريض إضافي: نصّ المواد من النواة القانونية الموحّدة (buildLegalContextForAI) +
  //    القاعدة الإلزامية «لا تخترع مواد» — كي تُبنى المحاكاة حول نصّ حقيقي لا حول مرجع مجرّد.
  //    سقوط آمن إلى بلا سياق عند أي تعذّر.
  const groundingQuery = [input.caseFacts, input.claims, input.defenses, input.evidenceSummary].filter(Boolean).join("\n").slice(0, 1800) || input.caseFacts;
  const grounding = await buildLegalContextForAI(groundingQuery, { limit: 8 }).catch(() => null);

  // 4) الرؤية القضائية: مزوّد مركزي (JSON) + احتياط حتمي/mock.
  const det = buildDeterministicJudicialView(input, analysis, plan);
  let parsed: JudicialNarrative | null = null;
  let generated = false;
  if (plan) {
    try {
      const llm = await callCentralProvider({
        systemPrompt: buildJudicialSystemPrompt(),
        userPrompt: buildJudicialUserPrompt(input, analysis, plan, grounding?.hasArticles ? grounding.contextText : undefined),
        maxTokens: 2000,
      });
      if (llm.ok && llm.content.trim()) {
        parsed = parseJudicialView(llm.content);
        generated = parsed !== null;
      }
    } catch {
      parsed = null;
      generated = false;
    }
  }
  const narrative = parsed ? mergeNarrative(parsed, det) : det;

  // 5) الحوكمة: موثوقية المحاكاة + صياغة احتمالية غير ملزمة + تحفّظ نقص المصادر.
  const reliable = analysis.grounded && analysis.confidence >= MIN_SIM_CONFIDENCE;
  const outcome = wrapOutcome(narrative.probableDirection, narrative.tentativeRuling, narrative.draftReasoning, reliable);

  const aiMeta = await resolveAiProvider();
  return {
    caseSummary: plan?.caseSummary || det.disputeSubject || analysis.disputeCharacterization,
    preliminaryCharacterization: narrative.preliminaryCharacterization,
    probableJurisdiction: narrative.probableJurisdiction,
    admissibilityNotes: narrative.admissibilityNotes,
    materialFacts: analysis.materialFacts, // 5 — من Case Analysis
    immaterialFacts: analysis.immaterialFacts, // 6
    disputeSubject: narrative.disputeSubject,
    burdenOfProof: analysis.burdenOfProof, // 8
    influentialEvidence: narrative.influentialEvidence,
    judicialQuestions: narrative.judicialQuestions,
    defensesHeardFirst: narrative.defensesHeardFirst,
    proceduralDecisions: narrative.proceduralDecisions,
    clarificationsNeeded: narrative.clarificationsNeeded,
    plaintiffPosition: narrative.plaintiffPosition,
    defendantPosition: narrative.defendantPosition,
    probableDirection: outcome.probableDirection, // 16 — محكوم
    draftReasoning: outcome.draftReasoning, // 17 — محكوم
    tentativeRuling: outcome.tentativeRuling, // 18 — محكوم غير ملزم
    appealRisks: narrative.appealRisks,
    cassationFactors: narrative.cassationFactors,
    confidence: analysis.confidence, // 21
    citations: analysis.citations, // 22 — من Citation Engine عبر RAG (لا اختلاق)
    influentialArticles: analysis.influentialArticles,
    similarRulings: analysis.similarRulings,
    caseStrengthScore: analysis.caseStrengthScore,
    litigationStage: stage,
    grounded: analysis.grounded,
    reliable,
    trainingDisclaimer: TRAINING_DISCLAIMER,
    insufficientNote: reliable ? null : INSUFFICIENT_DISCLAIMER,
    generated,
    provider: generated ? plan?.provider || "central" : aiMeta.name,
    model: aiMeta.model,
  };
}

// ───────────────────────── الحوكمة (منع الحكم القطعي عند نقص المصادر) ─────────────────────────

/** يصوغ الاتجاه/المنطوق/الأسباب بصيغة احتمالية غير ملزمة، أو تحفّظاً عند عدم الموثوقية. */
export function wrapOutcome(
  direction: string,
  ruling: string,
  reasoning: string[],
  reliable: boolean
): { probableDirection: string; tentativeRuling: string; draftReasoning: string[] } {
  if (!reliable) {
    return {
      probableDirection: INSUFFICIENT_DISCLAIMER,
      tentativeRuling: INSUFFICIENT_DISCLAIMER,
      draftReasoning: [INSUFFICIENT_DISCLAIMER],
    };
  }
  return {
    probableDirection: `${direction} — ${PROBABILISTIC_TAG}`,
    tentativeRuling: `منطوق محتمل (غير ملزم): ${ruling} — ${PROBABILISTIC_TAG}`,
    draftReasoning: reasoning,
  };
}

// ───────────────────────── تحليل JSON القادم من المزوّد ─────────────────────────

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asString).filter((s) => s.length > 0) : [];
}

/** يستخرج كائن JSON من ناتج المزوّد ويحوّله لسرد قضائي مُتحقَّق الشكل (أو null). */
export function parseJudicialView(content: string): JudicialNarrative | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const r = obj as Record<string, unknown>;
  const view: JudicialNarrative = {
    preliminaryCharacterization: asString(r.preliminaryCharacterization),
    probableJurisdiction: asString(r.probableJurisdiction),
    admissibilityNotes: asStringArray(r.admissibilityNotes),
    disputeSubject: asString(r.disputeSubject),
    influentialEvidence: asStringArray(r.influentialEvidence),
    judicialQuestions: asStringArray(r.judicialQuestions),
    defensesHeardFirst: asStringArray(r.defensesHeardFirst),
    proceduralDecisions: asStringArray(r.proceduralDecisions),
    clarificationsNeeded: asStringArray(r.clarificationsNeeded),
    plaintiffPosition: asString(r.plaintiffPosition),
    defendantPosition: asString(r.defendantPosition),
    probableDirection: asString(r.probableDirection),
    draftReasoning: asStringArray(r.draftReasoning),
    tentativeRuling: asString(r.tentativeRuling),
    appealRisks: asStringArray(r.appealRisks),
    cassationFactors: asStringArray(r.cassationFactors),
  };
  if (!view.preliminaryCharacterization && view.judicialQuestions.length === 0 && !view.probableDirection) return null;
  return view;
}

function mergeNarrative(ai: JudicialNarrative, det: JudicialNarrative): JudicialNarrative {
  const pick = (a: string, d: string) => a || d;
  const pickArr = (a: string[], d: string[]) => (a.length ? a : d);
  return {
    preliminaryCharacterization: pick(ai.preliminaryCharacterization, det.preliminaryCharacterization),
    probableJurisdiction: pick(ai.probableJurisdiction, det.probableJurisdiction),
    admissibilityNotes: pickArr(ai.admissibilityNotes, det.admissibilityNotes),
    disputeSubject: pick(ai.disputeSubject, det.disputeSubject),
    influentialEvidence: pickArr(ai.influentialEvidence, det.influentialEvidence),
    judicialQuestions: pickArr(ai.judicialQuestions, det.judicialQuestions),
    defensesHeardFirst: pickArr(ai.defensesHeardFirst, det.defensesHeardFirst),
    proceduralDecisions: pickArr(ai.proceduralDecisions, det.proceduralDecisions),
    clarificationsNeeded: pickArr(ai.clarificationsNeeded, det.clarificationsNeeded),
    plaintiffPosition: pick(ai.plaintiffPosition, det.plaintiffPosition),
    defendantPosition: pick(ai.defendantPosition, det.defendantPosition),
    probableDirection: pick(ai.probableDirection, det.probableDirection),
    draftReasoning: pickArr(ai.draftReasoning, det.draftReasoning),
    tentativeRuling: pick(ai.tentativeRuling, det.tentativeRuling),
    appealRisks: pickArr(ai.appealRisks, det.appealRisks),
    cassationFactors: pickArr(ai.cassationFactors, det.cassationFactors),
  };
}

// ───────────────────────── الاحتياط الحتمي (mock، بلا اختلاق مصادر) ─────────────────────────

function sentences(text: string): string[] {
  return (text ?? "")
    .split(/[.؟!\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

/** سرد قضائي حتمي قابل للتكرار من المدخلات + التحليل + خطة الوكيل (دون اختلاق مصادر). */
export function buildDeterministicJudicialView(
  input: JudicialSimulationInput,
  analysis: CaseAnalysisResult,
  plan: LegalActionPlan | null
): JudicialNarrative {
  const proc = buildProceduralView(input, analysis);
  const topRef = analysis.influentialArticles[0]?.reference;
  const subject = input.claims?.trim() || analysis.materialFacts[0] || sentences(input.caseFacts)[0] || "محل النزاع";

  const preliminaryCharacterization = `تكييف قضائي أولي: ${analysis.disputeCharacterization}`;
  const disputeSubject = `محل النزاع: ${subject}.`;

  const influentialEvidence: string[] = [];
  if (input.evidenceSummary?.trim()) influentialEvidence.push(`ملخّص البيّنات المقدّم: ${input.evidenceSummary.trim()}`);
  analysis.requiredEvidence.forEach((e) => influentialEvidence.push(e));
  if (influentialEvidence.length === 0) influentialEvidence.push("تتحدّد البيّنات المؤثّرة بعد تقديم الأطراف لمستنداتهم.");

  const judicialQuestions: string[] = [
    "ما سند العلاقة محل النزاع وتاريخ نشوئها؟",
    "هل تتوافر شروط قبول الدعوى (الصفة/المصلحة/الميعاد)؟",
    "ما الدليل المباشر على واقعة الإخلال أو الضرر؟",
    "هل جرى الوفاء كلياً أو جزئياً، ومتى؟",
  ];
  if (topRef) judicialQuestions.push(`ما مدى انطباق ${topRef} على الواقعة محل النظر؟`);

  const score = analysis.caseStrengthScore;
  const plaintiffPosition =
    score >= 60
      ? "مركز المدّعي مدعوم نسبياً بوجود سند وإسناد، ويبقى رهن اكتمال البيّنة."
      : "مركز المدّعي يحتاج إلى تعزيز البيّنة والإسناد لإثبات الطلبات.";
  const defendantPosition = input.defenses?.trim()
    ? "للمدّعى عليه دفوع تحتاج فحصاً شكلاً وموضوعاً قد تؤخّر الفصل أو تُسقط بعض الطلبات."
    : "لم يُبدِ المدّعى عليه دفوعاً واضحة بعد؛ يُمكَّن من الجواب قبل الفصل.";

  const rawDirection =
    score >= 65
      ? "ترجيح كفة المدّعي مبدئياً متى اكتملت البيّنة المؤيِّدة للطلبات"
      : score <= 40
        ? "ترجيح عدم ثبوت الدعوى مبدئياً لضعف الإسناد/البيّنة"
        : "النتيجة متقاربة وتتوقّف على ما يُقدَّم من بيّنات في الجلسة";

  const draftReasoning: string[] = [
    "بحث توافر شروط قبول الدعوى والاختصاص قبل الموضوع.",
    "تقدير ثبوت العلاقة محل النزاع بحسب المستندات.",
    "بحث قيام واقعة الإخلال/الضرر ومدى نسبتها للمدّعى عليه.",
  ];
  if (topRef) draftReasoning.push(`تطبيق ${topRef} على الواقعة الثابتة.`);
  draftReasoning.push("تقدير الطلبات ومقدارها في ضوء البيّنة المقبولة.");

  const rawRuling =
    score >= 65
      ? "إجابة المدّعي إلى بعض طلباته بقدر ما يثبت منها بالبيّنة"
      : score <= 40
        ? "عدم ثبوت الدعوى وردّها مع بقاء الحق في إثباتها مستقبلاً عند توافر البيّنة"
        : "الفصل بحسب ما يترجّح بعد تقديم البيّنات وتمكين الأطراف";

  const appealRisks: string[] = [
    "احتمال الطعن لقصور التسبيب إن لم تُناقَش الدفوع الجوهرية.",
    "تأثّر النتيجة باكتمال البيّنة ومناقشتها.",
  ];
  if (topRef) appealRisks.push(`احتمال الطعن لمخالفة تطبيق ${topRef}.`);

  const cassationFactors: string[] = [
    "سلامة تطبيق النظام على الوقائع الثابتة.",
    "كفاية التسبيب وردّ الدفوع الجوهرية.",
    "صحة الإجراءات والتبليغ وانعقاد الخصومة.",
  ];

  return {
    preliminaryCharacterization,
    probableJurisdiction: proc.jurisdiction,
    admissibilityNotes: proc.admissibilityNotes,
    disputeSubject,
    influentialEvidence,
    judicialQuestions: plan?.suggestedQuestions?.length ? mergeUnique(judicialQuestions, plan.suggestedQuestions) : judicialQuestions,
    defensesHeardFirst: proc.defensesHeardFirst,
    proceduralDecisions: proc.proceduralDecisions,
    clarificationsNeeded: proc.clarificationsNeeded,
    plaintiffPosition,
    defendantPosition,
    probableDirection: rawDirection,
    draftReasoning,
    tentativeRuling: rawRuling,
    appealRisks,
    cassationFactors,
  };
}

function mergeUnique(a: string[], b: string[]): string[] {
  const out = [...a];
  const seen = new Set(a.map((s) => s.trim()));
  for (const x of b) {
    const k = x.trim();
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function fallbackAnalysis(): CaseAnalysisResult {
  return {
    disputeCharacterization: "تعذّر إنشاء تحليل القضية؛ يلزم استكمال المدخلات والمصادر.",
    materialFacts: [],
    immaterialFacts: [],
    requiredEvidence: [],
    burdenOfProof: "البيّنة على من ادّعى واليمين على من أنكر.",
    potentialDefenses: [],
    legalRisks: [],
    strengths: [],
    weaknesses: [],
    influentialArticles: [],
    similarRulings: [],
    caseStrengthScore: 0,
    confidence: 0,
    citations: [],
    grounded: false,
    generated: false,
    provider: "none",
    model: "",
  };
}
