// الوكيل القانوني (المرحلة السابعة).
// يحوّل تحليل القضية إلى خطة عمل عملية للمحامي، مُسنَدة وقابلة للتتبّع.
// مسار التنفيذ: مدخلات → Case Analysis Engine → Legal RAG → Citation Engine
//             → AI Provider → Legal Agent → Action Plan.
// لا يعدّل أيّاً من المراحل السابقة؛ يستدعيها فقط.
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { resolveAiProvider } from "@/lib/modules/ai/ai-provider";
import { buildLegalContextForAI } from "@/lib/modules/legal-core/legal-retrieval";
import { analyzeCase } from "@/lib/modules/case-analysis/case-analysis-engine";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import { classifyDefense, type DefenseCategory } from "@/lib/modules/case-analysis/defense-classifier";
import type { Citation } from "@/lib/modules/citations/citation-engine";
import { buildLegalAgentSystemPrompt, buildLegalAgentUserPrompt } from "./legal-agent-prompts";
import type { AgentDefense, AgentStrategy, LegalActionPlan, LegalAgentInput, PartyRole } from "./types";

export const MIN_AGENT_CONFIDENCE = 0.4;
export const PRELIMINARY_DISCLAIMER =
  "التحليل أولي، وتوجد حاجة إلى مصادر أو مستندات إضافية قبل اعتماد الاستراتيجية.";

export async function runLegalAgent(input: LegalAgentInput): Promise<LegalActionPlan> {
  // 1) تحليل القضية (Case Analysis Engine → Legal RAG → Citation Engine).
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

  // 2) تأريض إضافي: نصّ المواد من النواة القانونية الموحّدة (buildLegalContextForAI) +
  //    القاعدة الإلزامية «لا تخترع مواد» — كي تُبنى الخطة حول نصّ حقيقي لا حول مرجع مجرّد.
  //    سقوط آمن إلى بلا سياق عند أي تعذّر.
  const groundingQuery = [input.caseFacts, input.claims, input.defenses].filter(Boolean).join("\n").slice(0, 1800) || input.caseFacts;
  const grounding = await buildLegalContextForAI(groundingQuery, { limit: 8 }).catch(() => null);

  // 3) الطبقة الاستراتيجية عبر المزوّد المركزي (JSON)، مع احتياط حتمي/mock.
  const det = buildDeterministicStrategy(input, analysis);
  let parsed: AgentStrategy | null = null;
  let generated = false;
  try {
    const llm = await callCentralProvider({
      systemPrompt: buildLegalAgentSystemPrompt(),
      userPrompt: buildLegalAgentUserPrompt(input, analysis, grounding?.hasArticles ? grounding.contextText : undefined),
      maxTokens: 1800,
    });
    if (llm.ok && llm.content.trim()) {
      parsed = parseAgentPlan(llm.content);
      generated = parsed !== null;
    }
  } catch {
    parsed = null;
    generated = false;
  }
  const strategy = parsed ? mergeStrategy(parsed, det) : det;

  // 4) الدفوع: أساس من تحليل القضية + إضافات المزوّد، كلها موسومة بحالة الإسناد.
  const suggestedDefenses = buildAgentDefenses(analysis, strategy.additionalDefenses);

  // 5) الحوكمة: تحفّظ صريح عند نقص المصادر/الثقة، وتوصية متحفّظة لا قطعية.
  const preliminary = !analysis.grounded || analysis.confidence < MIN_AGENT_CONFIDENCE;
  const disclaimer = preliminary ? PRELIMINARY_DISCLAIMER : null;
  const practicalRecommendation = preliminary
    ? `${PRELIMINARY_DISCLAIMER} — مبدئياً: ${strategy.practicalRecommendation}`
    : strategy.practicalRecommendation;

  const aiMeta = await resolveAiProvider();
  return {
    caseSummary: strategy.caseSummary,
    disputeCharacterization: analysis.disputeCharacterization,
    legalIssues: strategy.legalIssues,
    litigationStrategy: strategy.litigationStrategy,
    suggestedDefenses,
    requiredEvidence: analysis.requiredEvidence, // 7 — من تحليل القضية
    strengths: analysis.strengths, // 8
    weaknesses: analysis.weaknesses, // 9
    legalRisks: analysis.legalRisks, // 10
    successOpportunities: strategy.successOpportunities,
    pleadingPlan: strategy.pleadingPlan,
    suggestedQuestions: strategy.suggestedQuestions,
    gapsToClose: strategy.gapsToClose,
    practicalRecommendation,
    confidence: analysis.confidence, // 16
    citations: analysis.citations, // 17 — من Citation Engine عبر RAG (لا اختلاق)
    influentialArticles: analysis.influentialArticles,
    similarRulings: analysis.similarRulings,
    caseStrengthScore: analysis.caseStrengthScore,
    grounded: analysis.grounded,
    preliminary,
    disclaimer,
    generated,
    provider: generated ? analysis.provider || "central" : aiMeta.name,
    model: aiMeta.model,
  };
}

// ───────────────────────── الدفوع: وسم الإسناد (منع الهلوسة) ─────────────────────────

/** هل سند الدفع مدعوم باستشهاد حقيقي؟ يطابق أرقام السند بأرقام مراجع الاستشهادات. */
export function isBasisSupported(basis: string, citations: Citation[]): boolean {
  const text = (basis ?? "").trim();
  if (!text || citations.length === 0) return false;
  const basisNums = text.match(/\d+/g);
  if (!basisNums) return false;
  const refNums = new Set(citations.flatMap((c) => c.reference.match(/\d+/g) ?? []));
  return basisNums.some((n) => refNums.has(n));
}

/** يوسم دفعاً بحالة إسناده؛ ما لا سند له يُوسم «احتمالية تحتاج تحقق». */
export function markDefense(
  d: { text: string; category: DefenseCategory; basis: string | null },
  citations: Citation[]
): AgentDefense {
  const verified = isBasisSupported(d.basis ?? "", citations);
  return {
    text: d.text,
    category: d.category,
    basis: d.basis ?? null,
    verified,
    note: verified ? null : "احتمالية تحتاج تحقق",
  };
}

function buildAgentDefenses(
  analysis: CaseAnalysisResult,
  additional: AgentStrategy["additionalDefenses"]
): AgentDefense[] {
  const out: AgentDefense[] = [];
  const seen = new Set<string>();
  const push = (d: { text: string; category: DefenseCategory; basis: string | null }) => {
    const key = d.text.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(markDefense(d, analysis.citations));
  };
  analysis.potentialDefenses.forEach((d) => push(d));
  additional.forEach((d) => push(d));
  return out;
}

// ───────────────────────── تحليل JSON القادم من المزوّد ─────────────────────────

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(asString).filter((s) => s.length > 0) : [];
}
function asCategory(v: unknown): DefenseCategory | null {
  return v === "FORMAL" || v === "SUBSTANTIVE" || v === "PROCEDURAL" ? v : null;
}
function asAdditionalDefenses(v: unknown): AgentStrategy["additionalDefenses"] {
  if (!Array.isArray(v)) return [];
  const out: AgentStrategy["additionalDefenses"] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const text = asString(rec.text);
      if (!text) continue;
      const basis = asString(rec.basis);
      out.push({ text, category: asCategory(rec.category) ?? classifyDefense(text), basis: basis || null });
    } else if (typeof item === "string" && item.trim()) {
      out.push({ text: item.trim(), category: classifyDefense(item), basis: null });
    }
  }
  return out;
}

/** يستخرج كائن JSON من ناتج المزوّد ويحوّله لاستراتيجية مُتحقَّقة الشكل (أو null). */
export function parseAgentPlan(content: string): AgentStrategy | null {
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
  const strategy: AgentStrategy = {
    caseSummary: asString(r.caseSummary),
    legalIssues: asStringArray(r.legalIssues),
    litigationStrategy: asString(r.litigationStrategy),
    successOpportunities: asStringArray(r.successOpportunities),
    pleadingPlan: asStringArray(r.pleadingPlan),
    suggestedQuestions: asStringArray(r.suggestedQuestions),
    gapsToClose: asStringArray(r.gapsToClose),
    practicalRecommendation: asString(r.practicalRecommendation),
    additionalDefenses: asAdditionalDefenses(r.additionalDefenses),
  };
  if (!strategy.caseSummary && !strategy.litigationStrategy && strategy.pleadingPlan.length === 0) return null;
  return strategy;
}

function mergeStrategy(ai: AgentStrategy, det: AgentStrategy): AgentStrategy {
  return {
    caseSummary: ai.caseSummary || det.caseSummary,
    legalIssues: ai.legalIssues.length ? ai.legalIssues : det.legalIssues,
    litigationStrategy: ai.litigationStrategy || det.litigationStrategy,
    successOpportunities: ai.successOpportunities.length ? ai.successOpportunities : det.successOpportunities,
    pleadingPlan: ai.pleadingPlan.length ? ai.pleadingPlan : det.pleadingPlan,
    suggestedQuestions: ai.suggestedQuestions.length ? ai.suggestedQuestions : det.suggestedQuestions,
    gapsToClose: ai.gapsToClose.length ? ai.gapsToClose : det.gapsToClose,
    practicalRecommendation: ai.practicalRecommendation || det.practicalRecommendation,
    additionalDefenses: ai.additionalDefenses,
  };
}

// ───────────────────────── الاحتياط الحتمي (mock، بلا اختلاق مصادر) ─────────────────────────

function sentences(text: string): string[] {
  return (text ?? "")
    .split(/[.؟!\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

/** استراتيجية حتمية قابلة للتكرار من المدخلات + تحليل القضية (دون اختلاق مصادر). */
export function buildDeterministicStrategy(input: LegalAgentInput, analysis: CaseAnalysisResult): AgentStrategy {
  const role: PartyRole | undefined = input.partyRole;
  const isPlaintiff = role === "PLAINTIFF";
  const isDefendant = role === "DEFENDANT";
  const roleLabel = isPlaintiff ? "المدّعي" : isDefendant ? "المدّعى عليه" : "الطرف";
  const factSnippet = sentences(input.caseFacts).slice(0, 2).join(". ") || input.caseFacts.trim().slice(0, 200);
  const topRef = analysis.influentialArticles[0]?.reference;

  const caseSummary = `${roleLabel} في نزاع ${input.caseType?.trim() || "قانوني"}${
    input.jurisdiction?.trim() ? ` أمام ${input.jurisdiction.trim()}` : ""
  }: ${factSnippet}. الطلبات: ${input.claims?.trim() || "غير محدّدة بدقّة"}.`;

  const legalIssues: string[] = [
    "تكييف العلاقة محل النزاع قانونياً.",
    "مدى ثبوت الواقعة المنشئة للالتزام (الإخلال/الضرر).",
    "مدى أحقية الطلبات ومقدارها.",
  ];
  if (input.defenses?.trim()) legalIssues.push("مدى وجاهة دفوع الخصم شكلاً وموضوعاً.");
  if (topRef) legalIssues.push(`مدى انطباق ${topRef} على الواقعة.`);

  const litigationStrategy = isDefendant
    ? "الدفع شكلاً وإجراءً ابتداءً (الاختصاص/القبول/التقادم)، ثم موضوعاً بنفي الإخلال أو إثبات الوفاء/البراءة، مع الطعن في بيّنات المدّعي ومستنداته."
    : "إثبات العلاقة والإخلال والضرر بالمحرّرات والبيّنات، والاستناد إلى المواد النظامية المؤثّرة، والردّ الاستباقي على الدفوع المتوقّعة، وتحديد الطلبات ومقدارها بدقّة.";

  const successOpportunities: string[] = [];
  if (analysis.caseStrengthScore >= 60) successOpportunities.push("ارتفاع نسبي لاحتمال القبول لتوفّر سند وإسناد.");
  if (analysis.influentialArticles.length && topRef) successOpportunities.push(`الاستناد إلى ${topRef} يعزّز المركز.`);
  if (analysis.similarRulings.length) successOpportunities.push("توافر أحكام/سوابق مشابهة يدعم الطلب.");
  if (successOpportunities.length === 0) successOpportunities.push("تتحدّد الفرص بعد استكمال البيّنات والإسناد.");

  const pleadingPlan: string[] = isDefendant
    ? [
        "إثارة الدفوع الشكلية والإجرائية ابتداءً (الاختصاص/القبول/التقادم).",
        "الطعن في بيّنات المدّعي ومستنداته.",
        "نفي الإخلال أو إثبات الوفاء/البراءة من الالتزام.",
        "تقديم المستندات المضادّة والمذكرة الجوابية.",
        "طلب حصر المطالبة أو دفع مقدارها.",
      ]
    : [
        "تثبيت العلاقة محل النزاع بالمستندات.",
        "إثبات واقعة الإخلال/الضرر المُدّعى.",
        "تحديد الطلبات ومقدارها بدقّة في الصحيفة.",
        "الاستناد إلى المواد النظامية والأحكام المؤثّرة.",
        "الردّ الاستباقي على الدفوع المتوقّعة للخصم.",
        "طلب ما يلزم من بيّنات (شهادة/خبرة).",
      ];

  const suggestedQuestions: string[] = [
    "ما سند العلاقة محل النزاع وتاريخ نشوئها؟",
    "ما الدليل المباشر على واقعة الإخلال/الضرر؟",
    "هل جرى الوفاء كلياً أو جزئياً، ومتى؟",
    "ما تاريخ العلم بالواقعة (لاحتساب المُدد والمواعيد)؟",
  ];

  const gapsToClose: string[] = [];
  if (!analysis.grounded || analysis.confidence < 0.5) gapsToClose.push("تعزيز الإسناد النظامي والمصادر القضائية.");
  if (!input.documents?.length) gapsToClose.push("إرفاق المستندات والمحرّرات المؤيِّدة.");
  analysis.weaknesses.slice(0, 2).forEach((w) => gapsToClose.push(`معالجة: ${w}`));
  if (gapsToClose.length === 0) gapsToClose.push("لا ثغرات جوهرية ظاهرة قبل الجلسة.");

  const practicalRecommendation = isDefendant
    ? "التركيز على الدفوع الشكلية والإجرائية أولاً ثم الموضوعية، مع تجهيز المستندات المضادّة قبل الجلسة."
    : "المضيّ في الدعوى مع تركيز الإثبات على العلاقة والإخلال والضرر، وإكمال المستندات وتثبيت السند النظامي قبل الجلسة.";

  return {
    caseSummary,
    legalIssues,
    litigationStrategy,
    successOpportunities,
    pleadingPlan,
    suggestedQuestions,
    gapsToClose,
    practicalRecommendation,
    additionalDefenses: [],
  };
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
