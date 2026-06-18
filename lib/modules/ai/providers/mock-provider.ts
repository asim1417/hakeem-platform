// مزوّد محاكاة حتمي (offline) — متاح دائماً، لا يحتاج مفتاحاً ولا شبكة.
// يبني نصّاً مُسنَداً من السياق فقط (لا يخترع مادة/حكم/مبدأ) ليبقى الخط عاملاً
// دون مزوّد حقيقي، ويُستعمل كسقوط منظم عند غياب المفاتيح.
import type { AiProvider, LegalGenInput } from "./base";
import { SECTION_ANALYSIS, SECTION_LIMITATIONS, SECTION_SHORT } from "../legal-prompts";

function sectioned(input: LegalGenInput): string {
  const { context } = input;
  const a = context.articles[0];
  const r = context.rulings[0];
  const p = context.principles[0];

  const short = a
    ? `استناداً إلى ${a.lawName} — المادة (${a.articleNumber})، تتصل الإجابة مباشرةً بالمصادر المرفقة أدناه.`
    : r
      ? `استناداً إلى الحكم رقم ${r.decisionNo ?? r.caseNo ?? r.id}، تتصل الإجابة بالمصادر المرفقة أدناه.`
      : "بحسب المصادر المرفقة أدناه.";

  const points: string[] = [];
  context.articles.slice(0, 3).forEach((art) =>
    points.push(`- ${art.lawName} — المادة (${art.articleNumber}): ${art.content.slice(0, 160)}`)
  );
  context.rulings.slice(0, 2).forEach((rul) =>
    points.push(`- حكم رقم ${rul.decisionNo ?? rul.caseNo ?? rul.id}: ${rul.text.slice(0, 160)}`)
  );
  context.principles.slice(0, 2).forEach((prn) => points.push(`- مبدأ قضائي: ${prn.title}`));
  const analysis = points.length
    ? `ترتبط الإجابة بالمصادر التالية بحسب أوزانها في السياق:\n${points.join("\n")}`
    : "لا مصادر كافية لبناء تحليل.";

  const limitations =
    "هذه صياغة محاكاة حتمية (دون مزوّد ذكاء مُفعّل)؛ تقتصر على المصادر المرفقة ولا تُغني عن مراجعة محامٍ مختص ولا تغطّي كل تفاصيل الواقعة.";

  return [SECTION_SHORT, short, "", SECTION_ANALYSIS, analysis, "", SECTION_LIMITATIONS, limitations].join("\n");
}

function summary(input: LegalGenInput): string {
  const { context } = input;
  const parts = [
    ...context.articles.slice(0, 3).map((a) => `${a.lawName} م/${a.articleNumber}`),
    ...context.rulings.slice(0, 2).map((r) => `حكم ${r.decisionNo ?? r.caseNo ?? r.id}`),
    ...context.principles.slice(0, 2).map((p) => `مبدأ: ${p.title}`),
  ];
  return parts.length ? `ملخّص المصادر المرفقة: ${parts.join("؛ ")}.` : "لا مصادر مرفقة.";
}

export function createMockProvider(): AiProvider {
  return {
    name: "mock",
    model: "mock-deterministic",
    available: () => true,
    generateLegalAnswer: async (input) => sectioned(input),
    summarizeLegalContext: async (input) => summary(input),
    draftLegalReasoning: async (input) => sectioned(input),
  };
}
