import { prisma } from "@/lib/prisma";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";
import { getRelationsForEntity } from "@/lib/modules/knowledge-graph/relations";
import { buildCitations, verifyCitations, type Citation } from "@/lib/modules/citations/citation-engine";
import { composeLegalAnswer, type LegalBasisItem, type RelatedItem } from "./legal-answer-composer";
import {
  buildLegalContext,
  type LegalContext,
  type RagArticle,
  type RagPrinciple,
  type RagRelation,
  type RagRuling,
} from "./context-builder";
import { GROUNDING_FALLBACK, NO_EXPLICIT_TEXT, hasSufficientGrounding } from "./grounding-guard";
import { fetchLinkedJudgments } from "./judgment-links";
import { getAiProvider } from "@/lib/modules/ai/ai-provider";

export interface RagResult {
  answer: string;
  shortAnswer: string;
  legalAnalysis: string;
  limitations: string;
  confidence: number;
  grounded: boolean; // هل الإجابة مُسنَدة لمصادر حقيقية؟
  /** ملاحظة على الأساس النظامي: تُملأ بـ NO_EXPLICIT_TEXT عند غياب نصّ نظامي صريح رغم وجود مصادر. */
  legalBasisNote: string | null;
  citations: Citation[];
  legalBasis: LegalBasisItem[]; // الأساس النظامي (مواد حقيقية من القاعدة)
  relatedArticles: Array<{ id: string; title: string; reason: string; weight: number }>;
  relatedRulings: RelatedItem[];
  relatedPrinciples: RelatedItem[];
  provider: string; // اسم مزوّد الذكاء المُهيّأ (openai/anthropic/gemini)، أو mock عند عدم الضبط
  /** هل ضُبط مزوّد ذكاء حقيقي (غير mock)؟ يميّز «لا مصادر» عن «لا مزوّد». */
  providerConfigured: boolean;
  model: string;
  providers: { name: string; status: string }[];
  generated: boolean; // هل وُلّد نصّ من المزوّد فعلاً؟
}

// نتيجة فارغة/غير مُسنَدة — تُرجِع مع ذلك المزوّد المُهيّأ فعلاً (لا "none" دائماً)،
// كي تميّز الواجهة بين «لا توجد مصادر كافية» و«لم يُضبط مزوّد ذكاء».
function emptyResult(
  answer: string,
  confidence: number,
  providers: { name: string; status: string }[]
): RagResult {
  const ai = getAiProvider();
  const providerConfigured = ai.name !== "mock";
  return {
    answer,
    shortAnswer: "",
    legalAnalysis: "",
    limitations: "",
    confidence,
    grounded: false,
    legalBasisNote: null,
    generated: false,
    citations: [],
    legalBasis: [],
    relatedArticles: [],
    relatedRulings: [],
    relatedPrinciples: [],
    provider: ai.name,
    providerConfigured,
    model: providerConfigured ? ai.model : "",
    providers,
  };
}

// خط التنفيذ: Question → Hybrid Search → Context Builder → Citation Engine
//            → Grounding Guard → AI Provider → Answer Composer → Grounded Answer
export async function legalRag(question: string): Promise<RagResult> {
  const q = question.trim();

  // 1) البحث الهجين
  const search = await hybridSearch({ q, limit: 15 });
  const scoreOf = (id: string) => search.results.find((r) => r.id === id)?.confidence ?? 0;
  const reasonOf = (id: string) => search.results.find((r) => r.id === id)?.reasons.join(" · ") ?? "تطابق";

  const articleIds = search.results.filter((r) => r.type === "article").map((r) => r.id);
  const rulingIds = search.results.filter((r) => r.type === "ruling").map((r) => r.id);
  const principleIds = search.results.filter((r) => r.type === "principle").map((r) => r.id);

  // 2) جلب الكيانات القائمة كاملةً + 3) علاقات الرسم المعرفي — مغلّفة بأمان
  // (أي تعذّر قاعدة لا يكسر الخط؛ يؤول إلى نقص مصادر فيردّ حارس الإسناد).
  let aRows: Array<{ id: string; title: string; content: string; lawName: string; articleNumber: number }> = [];
  let rRows: Array<{ id: string; judgmentTitle: string | null; judgmentText: string; caseNo: string | null; decisionNo: string | null; court: string | null }> = [];
  let pRows: Array<{ id: string; title: string; principleText: string }> = [];
  let relations: RagRelation[] = [];
  try {
    [aRows, rRows, pRows] = await Promise.all([
      prisma.legalArticle.findMany({
        where: { id: { in: articleIds } },
        select: { id: true, title: true, content: true, lawName: true, articleNumber: true },
      }),
      prisma.judicialCase.findMany({
        where: { id: { in: rulingIds } },
        select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true },
      }),
      prisma.judicialPrinciple.findMany({
        where: { id: { in: principleIds } },
        select: { id: true, title: true, principleText: true },
      }),
    ]);
    const relArrays = await Promise.all(articleIds.slice(0, 5).map((id) => getRelationsForEntity("article", id)));
    relations = relArrays.flat().map((r) => ({
      id: r.id, sourceType: r.sourceType, sourceId: r.sourceId, targetType: r.targetType,
      targetId: r.targetId, relation: r.relation, strength: r.strength,
    }));
  } catch {
    aRows = []; rRows = []; pRows = []; relations = [];
  }

  const articles: RagArticle[] = aRows.map((a) => ({
    id: a.id, title: `${a.lawName} — م/${a.articleNumber}: ${a.title}`, content: a.content,
    lawName: a.lawName, articleNumber: a.articleNumber, score: scoreOf(a.id), reason: reasonOf(a.id),
  }));
  const rulings: RagRuling[] = rRows.map((r) => ({
    id: r.id, title: `حكم ${r.decisionNo ?? r.caseNo ?? r.id}${r.court ? ` — ${r.court}` : ""}`,
    text: r.judgmentText ?? r.judgmentTitle ?? "", caseNo: r.caseNo, decisionNo: r.decisionNo, court: r.court,
    score: scoreOf(r.id), reason: reasonOf(r.id),
  }));
  const principles: RagPrinciple[] = pRows.map((p) => ({
    id: p.id, title: `مبدأ: ${p.title}`, text: p.principleText, score: scoreOf(p.id), reason: reasonOf(p.id),
  }));

  // 3b) ربط المواد الحاضرة بأحكامها عبر legal_article_case_links (قراءة فقط، بسقوف).
  //     يُغني السياق بالسوابق القضائية حين يخلو الرسم المعرفي من العلاقات (Neon).
  //     سقوط آمن: غياب الروابط ⇒ سياق المواد فقط.
  const presentArticleIds = articles.map((a) => a.id);
  const linkedRulings = await fetchLinkedJudgments(prisma, presentArticleIds, { perArticle: 3, total: 8 });
  // ندمج أحكام البحث مع الأحكام المرتبطة بالمواد (بنّاء السياق يزيل التكرار بالمعرّف).
  const allRulings: RagRuling[] = [...rulings, ...linkedRulings];

  // 4) بناء السياق الموزون
  const context = buildLegalContext({ question: q, articles, rulings: allRulings, principles, relations });

  // 5) حارس الإسناد — لا إجابة بلا مصادر كافية
  if (!hasSufficientGrounding(context)) {
    return emptyResult(GROUNDING_FALLBACK, context.confidence, search.providers);
  }

  // 6) الاستشهادات (مُتحقّق من وجودها فعلاً)
  const citations = await verifyCitations(buildCitations(context));

  // 7) المزوّد + مُركّب الإجابة — نصّ مُسنَد منظّم (مع سقوط منظّم إن غاب المزوّد)
  const composed = await composeLegalAnswer({ question: q, context, citations });

  return {
    answer: composed.answer,
    shortAnswer: composed.shortAnswer,
    legalAnalysis: composed.legalAnalysis,
    limitations: composed.limitations,
    confidence: context.confidence,
    grounded: true,
    // مصادر موجودة (أحكام مرتبطة) لكن بلا مادة نظامية صريحة ⇒ ننبّه أنّ لا نصّ صريح.
    legalBasisNote: composed.legalBasis.length === 0 ? NO_EXPLICIT_TEXT : null,
    generated: composed.generated,
    citations: composed.citations,
    legalBasis: composed.legalBasis,
    relatedArticles: context.articles.map((a) => ({ id: a.id, title: a.title, reason: a.reason, weight: a.weight })),
    relatedRulings: composed.relatedRulings,
    relatedPrinciples: composed.relatedPrinciples,
    provider: composed.provider,
    providerConfigured: composed.provider !== "mock",
    model: composed.model,
    providers: search.providers,
  };
}

export type { LegalContext };
