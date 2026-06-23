// مُركّب الإجابة القانونية: يطلب نصّاً من طبقة المزوّد ثم يحوّله إلى مخرج منظّم.
// الأجزاء السردية (الجواب المختصر/التحليل/التحفظات) من النموذج، أمّا الأجزاء
// المُسنَدة بنيوياً (الأساس النظامي/الأحكام/المبادئ/الاستشهادات) فتُشتق من السياق
// الحقيقي فقط — منعاً للهلوسة: لا يُسمح بمصدر لم يأتِ من السياق.
import { resolveAiProvider } from "@/lib/modules/ai/ai-provider";
import { SECTION_ANALYSIS, SECTION_LIMITATIONS, SECTION_SHORT } from "@/lib/modules/ai/legal-prompts";
import type { Citation } from "@/lib/modules/citations/citation-engine";
import type { LegalContext } from "./context-builder";

export interface LegalBasisItem {
  id: string;
  title: string;
  reference: string;
  weight: number;
}

export interface RelatedItem {
  id: string;
  title: string;
  reason: string;
  weight: number;
}

export interface ComposedLegalAnswer {
  answer: string; // النصّ الكامل كما ولّده المزوّد (أو سقوط منظّم)
  shortAnswer: string;
  legalAnalysis: string;
  limitations: string;
  legalBasis: LegalBasisItem[]; // مواد نظامية حقيقية من السياق
  relatedRulings: RelatedItem[];
  relatedPrinciples: RelatedItem[];
  citations: Citation[];
  confidence: number;
  provider: string;
  model: string;
  generated: boolean; // هل وُلّد نصّ فعلاً؟
}

const DEFAULT_LIMITATIONS =
  "تقتصر هذه الإجابة على المصادر المرفقة فقط، ولا تُغني عن مراجعة محامٍ مختص، وقد لا تغطّي كل تفاصيل الواقعة.";

export async function composeLegalAnswer(input: {
  question: string;
  context: LegalContext;
  citations: Citation[];
}): Promise<ComposedLegalAnswer> {
  const { question, context, citations } = input;
  const provider = await resolveAiProvider();

  let raw = "";
  try {
    raw = (await provider.generateLegalAnswer({ question, context })).trim();
  } catch {
    raw = "";
  }
  const generated = Boolean(raw);

  const sections = parseSections(raw);

  // أجزاء مُسنَدة بنيوياً — من السياق الحقيقي حصراً (لا من النموذج).
  const legalBasis: LegalBasisItem[] = context.articles.map((a) => ({
    id: a.id,
    title: a.title,
    reference: `${a.lawName} — المادة (${a.articleNumber})`,
    weight: a.weight,
  }));
  const relatedRulings: RelatedItem[] = context.rulings.map((r) => ({
    id: r.id,
    title: r.title,
    reason: r.reason,
    weight: r.weight,
  }));
  const relatedPrinciples: RelatedItem[] = context.principles.map((p) => ({
    id: p.id,
    title: p.title,
    reason: p.reason,
    weight: p.weight,
  }));

  const shortAnswer = sections.short || fallbackShort(context);
  const legalAnalysis = sections.analysis || "";
  const limitations = sections.limitations || DEFAULT_LIMITATIONS;
  const answer = generated ? raw : fallbackAnswer(context);

  return {
    answer,
    shortAnswer,
    legalAnalysis,
    limitations,
    legalBasis,
    relatedRulings,
    relatedPrinciples,
    citations,
    confidence: context.confidence,
    provider: provider.name,
    model: provider.model,
    generated,
  };
}

/** يفصل النصّ إلى أقسامه الثلاثة بحسب العناوين الثابتة. */
function parseSections(raw: string): { short: string; analysis: string; limitations: string } {
  if (!raw) return { short: "", analysis: "", limitations: "" };
  return {
    short: extractSection(raw, SECTION_SHORT, [SECTION_ANALYSIS, SECTION_LIMITATIONS]),
    analysis: extractSection(raw, SECTION_ANALYSIS, [SECTION_LIMITATIONS]),
    limitations: extractSection(raw, SECTION_LIMITATIONS, []),
  };
}

function extractSection(raw: string, header: string, stops: string[]): string {
  const start = raw.indexOf(header);
  if (start === -1) return "";
  let body = raw.slice(start + header.length);
  for (const stop of stops) {
    const idx = body.indexOf(stop);
    if (idx !== -1) body = body.slice(0, idx);
  }
  return body.trim();
}

function fallbackShort(context: LegalContext): string {
  const a = context.articles[0];
  if (a) return `استناداً إلى ${a.lawName} — المادة (${a.articleNumber})، راجع المصادر المرفقة أدناه.`;
  const r = context.rulings[0];
  if (r) return `استناداً إلى الحكم رقم ${r.decisionNo ?? r.caseNo ?? r.id}، راجع المصادر المرفقة أدناه.`;
  return "راجع المصادر القانونية المرفقة أدناه.";
}

function fallbackAnswer(context: LegalContext): string {
  return [
    SECTION_SHORT,
    fallbackShort(context),
    "",
    SECTION_ANALYSIS,
    "عُرضت المصادر القانونية ذات الصلة أدناه (لم يُولَّد نصّ من مزوّد ذكاء — راجع المواد والأحكام والمبادئ والاستشهادات).",
    "",
    SECTION_LIMITATIONS,
    DEFAULT_LIMITATIONS,
  ].join("\n");
}
