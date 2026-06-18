// محرك تحليل القضايا (المرحلة السادسة).
// يُبنى فوق Legal RAG (للإسناد) + طبقة المزوّد المركزي (للتحليل السردي)،
// دون تعديل أيٍّ من: Legal RAG / Citation Engine / Hybrid Search / KG / OpenSearch.
//
// خط التنفيذ: مدخلات القضية → Legal RAG (مصادر + استشهادات)
//            → AI (تحليل JSON مُسنَد) → دمج + تصنيف الدفوع → تقدير قوة الدعوى.
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { getAiProvider } from "@/lib/modules/ai/ai-provider";
import { legalRag, type RagResult } from "@/lib/modules/legal-rag/legal-rag-service";
import { classifyDefense, type DefenseCategory } from "./defense-classifier";
import { buildCaseAnalysisSystemPrompt, buildCaseAnalysisUserPrompt, type CaseSources } from "./case-prompts";
import type { CaseAnalysisInput, CaseAnalysisResult, CaseNarrative, PotentialDefense } from "./types";

export async function analyzeCase(input: CaseAnalysisInput): Promise<CaseAnalysisResult> {
  const facts = (input.facts ?? "").trim();

  // 1) استرجاع مُسنَد عبر Legal RAG (بلا تعديل) — يوفّر المواد والأحكام والاستشهادات والثقة.
  const ragQuery = [facts, input.claims, input.defenses].filter(Boolean).join("\n").slice(0, 1800) || facts;
  let rag: RagResult;
  try {
    rag = await legalRag(ragQuery);
  } catch {
    rag = emptyRag();
  }

  // 2) تحليل سردي عبر المزوّد المركزي بتعليمات إسناد صارمة (JSON).
  const sources = toSources(rag);
  const det = buildDeterministicAnalysis(input, rag);

  let parsed: CaseNarrative | null = null;
  let generated = false;
  try {
    const llm = await callCentralProvider({
      systemPrompt: buildCaseAnalysisSystemPrompt(),
      userPrompt: buildCaseAnalysisUserPrompt(input, sources),
      maxTokens: 1500,
    });
    if (llm.ok && llm.content.trim()) {
      parsed = parseCaseAnalysis(llm.content);
      generated = parsed !== null;
    }
  } catch {
    parsed = null;
    generated = false;
  }

  // 3) دمج: السرد من المزوّد إن صحّ، وإلا الاحتياط الحتمي (لا فراغ في المخرج).
  const narrative = parsed ? mergeNarrative(parsed, det) : det;

  // 4) تقدير قوة الدعوى (حتمي مُحكَم 0-100) + الثقة من الإسناد.
  const caseStrengthScore = computeCaseStrengthScore(rag, narrative);

  const aiMeta = getAiProvider();
  return {
    ...narrative,
    influentialArticles: rag.legalBasis, // 11 — من Legal RAG (مصادر حقيقية)
    similarRulings: rag.relatedRulings, // 12
    caseStrengthScore, // 13
    confidence: rag.confidence, // 14
    citations: rag.citations, // 15 — عبر Citation Engine داخل Legal RAG
    grounded: rag.grounded,
    generated,
    provider: generated ? aiMeta.name : "deterministic",
    model: generated ? aiMeta.model : "rule-based",
  };
}

// ───────────────────────── الإسناد → مصادر التوجيه ─────────────────────────

function toSources(rag: RagResult): CaseSources {
  return {
    articles: rag.legalBasis.map((a) => ({ reference: a.reference, snippet: a.title })),
    rulings: rag.relatedRulings.map((r) => ({ reference: r.title, snippet: r.reason })),
    principles: rag.relatedPrinciples.map((p) => ({ reference: p.title, snippet: p.reason })),
  };
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
function asDefenses(v: unknown): PotentialDefense[] {
  if (!Array.isArray(v)) return [];
  const out: PotentialDefense[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const text = asString(rec.text);
      if (!text) continue;
      out.push({ text, category: asCategory(rec.category) ?? classifyDefense(text), basis: asString(rec.basis) || null });
    } else if (typeof item === "string" && item.trim()) {
      out.push({ text: item.trim(), category: classifyDefense(item), basis: null });
    }
  }
  return out;
}

/** يستخرج كائن JSON من ناتج المزوّد ويحوّله لسرد مُتحقَّق الشكل (أو null). */
export function parseCaseAnalysis(content: string): CaseNarrative | null {
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
  const narrative: CaseNarrative = {
    disputeCharacterization: asString(r.disputeCharacterization),
    materialFacts: asStringArray(r.materialFacts),
    immaterialFacts: asStringArray(r.immaterialFacts),
    requiredEvidence: asStringArray(r.requiredEvidence),
    burdenOfProof: asString(r.burdenOfProof),
    potentialDefenses: asDefenses(r.potentialDefenses),
    legalRisks: asStringArray(r.legalRisks),
    strengths: asStringArray(r.strengths),
    weaknesses: asStringArray(r.weaknesses),
  };
  // يجب أن يحمل حدّاً أدنى من الفائدة وإلا فهو غير صالح.
  if (!narrative.disputeCharacterization && narrative.materialFacts.length === 0) return null;
  return narrative;
}

/** يملأ الحقول الفارغة في سرد المزوّد من الاحتياط الحتمي. */
function mergeNarrative(ai: CaseNarrative, det: CaseNarrative): CaseNarrative {
  return {
    disputeCharacterization: ai.disputeCharacterization || det.disputeCharacterization,
    materialFacts: ai.materialFacts.length ? ai.materialFacts : det.materialFacts,
    immaterialFacts: ai.immaterialFacts.length ? ai.immaterialFacts : det.immaterialFacts,
    requiredEvidence: ai.requiredEvidence.length ? ai.requiredEvidence : det.requiredEvidence,
    burdenOfProof: ai.burdenOfProof || det.burdenOfProof,
    potentialDefenses: ai.potentialDefenses.length ? ai.potentialDefenses : det.potentialDefenses,
    legalRisks: ai.legalRisks.length ? ai.legalRisks : det.legalRisks,
    strengths: ai.strengths.length ? ai.strengths : det.strengths,
    weaknesses: ai.weaknesses.length ? ai.weaknesses : det.weaknesses,
  };
}

// ───────────────────────── الاحتياط الحتمي (بلا اختلاق مصادر) ─────────────────────────

const LEGAL_HINTS = [
  "عقد", "التزام", "دفع", "سداد", "ضرر", "تعويض", "مخالفة", "إخلال", "مبلغ",
  "اتفاق", "شرط", "تأخر", "تسليم", "فسخ", "بطلان", "غبن", "تغرير", "أجرة", "راتب",
];

function sentences(text: string): string[] {
  return (text ?? "")
    .split(/[.؟!\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5)
    .slice(0, 12);
}

/** تحليل حتمي قابل للتكرار يُبنى من المدخلات + إسناد RAG (دون أي اختلاق). */
export function buildDeterministicAnalysis(input: CaseAnalysisInput, rag: RagResult): CaseNarrative {
  const factSentences = sentences(input.facts);
  let materialFacts = factSentences.filter((s) => LEGAL_HINTS.some((k) => s.includes(k)));
  let immaterialFacts = factSentences.filter((s) => !LEGAL_HINTS.some((k) => s.includes(k)));
  if (materialFacts.length === 0) {
    materialFacts = factSentences;
    immaterialFacts = [];
  }

  const subject = (input.claims?.trim() || factSentences[0] || "محل النزاع").slice(0, 120);
  const topRef = rag.legalBasis[0]?.reference;
  const disputeCharacterization = `نزاع ${input.caseType?.trim() || "قانوني"} يتعلّق بـ«${subject}»${
    topRef ? `، يتّصل ابتداءً بـ${topRef}` : "، ويلزم تحديد سنده النظامي من المكتبة"
  }.`;

  const requiredEvidence = [
    "إثبات قيام العلاقة محل النزاع (عقد/التزام/واقعة).",
    "إثبات واقعة الإخلال أو الضرر المُدّعى.",
    "إثبات مقدار المطالبة أو التعويض المطلوب.",
    "المحرّرات والمستندات المؤيِّدة للطلبات.",
  ];

  const burdenOfProof =
    "وفق قاعدة «البيّنة على من ادّعى واليمين على من أنكر»: يقع عبء إثبات الطلبات على المدّعي، ويقع عبء إثبات الدفوع على المدّعى عليه.";

  const potentialDefenses: PotentialDefense[] = input.defenses?.trim()
    ? sentences(input.defenses).map((d) => ({ text: d, category: classifyDefense(d), basis: null }))
    : [
        { text: "الدفع بعدم الاختصاص (النوعي أو المكاني).", category: "PROCEDURAL", basis: null },
        { text: "الدفع بالتقادم أو سقوط الحق بمضي المدة.", category: "PROCEDURAL", basis: null },
        { text: "الدفع بالوفاء أو البراءة من الالتزام.", category: "SUBSTANTIVE", basis: null },
      ];

  const legalRisks: string[] = [];
  if (!rag.grounded || rag.confidence < 0.5) legalRisks.push("ضعف السند النظامي المباشر في المصادر المتاحة قد يُضعف المركز.");
  if (input.defenses?.trim()) legalRisks.push("دفوع المدّعى عليه قد تؤخّر الفصل أو تُسقط بعض الطلبات.");
  legalRisks.push("احتمال عدم كفاية البيّنة لإثبات بعض الوقائع المنتِجة.");

  const strengths: string[] = [];
  if (rag.legalBasis.length) strengths.push(`سند نظامي مباشر: ${rag.legalBasis[0].reference}.`);
  if (rag.relatedRulings.length) strengths.push("توافر أحكام/سوابق قضائية مشابهة تدعم الطلب.");
  if (input.claims?.trim()) strengths.push("وضوح الطلبات وتحديدها.");
  if (strengths.length === 0) strengths.push("لا عناصر قوة بارزة قبل اكتمال البيّنة والإسناد.");

  const weaknesses: string[] = [];
  if (!rag.legalBasis.length) weaknesses.push("غياب سند نظامي مباشر في المصادر المتاحة.");
  if (input.defenses?.trim()) weaknesses.push("وجود دفوع جوهرية للمدّعى عليه تحتاج إلى ردّ مُسنَد.");
  if (rag.confidence < 0.5) weaknesses.push("انخفاض ثقة الإسناد يستلزم تعزيز المصادر القانونية.");
  if (weaknesses.length === 0) weaknesses.push("لا نقاط ضعف بارزة في ضوء المصادر الحالية.");

  return {
    disputeCharacterization,
    materialFacts,
    immaterialFacts,
    requiredEvidence,
    burdenOfProof,
    potentialDefenses,
    legalRisks,
    strengths,
    weaknesses,
  };
}

// ───────────────────────── تقدير قوة الدعوى ─────────────────────────

/** تقدير حتمي مُحكَم لقوة الدعوى (0-100) من الإسناد + ميزان القوة/الضعف. */
export function computeCaseStrengthScore(rag: RagResult, n: CaseNarrative): number {
  let s = 50;
  s += Math.round(rag.confidence * 30); // قوة الإسناد حتى +30
  s += Math.min(rag.legalBasis.length, 3) * 3; // مواد نظامية مؤثّرة
  s += Math.min(rag.relatedRulings.length, 3) * 2; // أحكام مشابهة
  s += Math.min(n.strengths.length, 5) * 2;
  s -= Math.min(n.weaknesses.length, 5) * 3;
  s -= Math.min(n.potentialDefenses.length, 5) * 2; // دفوع الخصم تخفض التقدير
  if (!rag.grounded) s -= 10;
  return Math.max(0, Math.min(100, Math.round(s)));
}

function emptyRag(): RagResult {
  return {
    answer: "",
    shortAnswer: "",
    legalAnalysis: "",
    limitations: "",
    confidence: 0,
    grounded: false,
    legalBasisNote: null,
    generated: false,
    citations: [],
    legalBasis: [],
    relatedArticles: [],
    relatedRulings: [],
    relatedPrinciples: [],
    provider: "none",
    providerConfigured: false,
    model: "",
    providers: [],
  };
}
