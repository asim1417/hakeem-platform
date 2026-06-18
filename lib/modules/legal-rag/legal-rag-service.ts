import { prisma } from "@/lib/prisma";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { hybridSearch } from "@/lib/modules/legal-search/hybrid-search";
import { getRelationsForEntity } from "@/lib/modules/knowledge-graph/relations";
import { buildCitations, verifyCitations, type Citation } from "@/lib/modules/citations/citation-engine";
import {
  buildLegalContext,
  type LegalContext,
  type RagArticle,
  type RagPrinciple,
  type RagRelation,
  type RagRuling,
} from "./context-builder";
import {
  GROUNDING_FALLBACK,
  buildGroundedUserPrompt,
  buildGroundingSystemPrompt,
  hasSufficientGrounding,
} from "./grounding-guard";

export interface RagResult {
  answer: string;
  confidence: number;
  grounded: boolean; // هل الإجابة مُسنَدة لمصادر حقيقية؟
  citations: Citation[];
  relatedArticles: Array<{ id: string; title: string; reason: string; weight: number }>;
  relatedRulings: Array<{ id: string; title: string; reason: string; weight: number }>;
  relatedPrinciples: Array<{ id: string; title: string; reason: string; weight: number }>;
  providers: { name: string; status: string }[];
  generated: boolean; // هل وُلّد نصّ من الـ LLM فعلاً؟
}

// خط التنفيذ: Question → Hybrid Search → Context Builder → Citation Engine → LLM → Grounded Answer
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

  // 4) بناء السياق الموزون
  const context = buildLegalContext({ question: q, articles, rulings, principles, relations });

  // 5) حارس الإسناد — لا إجابة بلا مصادر كافية
  if (!hasSufficientGrounding(context)) {
    return {
      answer: GROUNDING_FALLBACK, confidence: context.confidence, grounded: false, generated: false,
      citations: [], relatedArticles: [], relatedRulings: [], relatedPrinciples: [], providers: search.providers,
    };
  }

  // 6) الاستشهادات (مُتحقّق من وجودها فعلاً)
  const citations = await verifyCitations(buildCitations(context));

  // 7) التوليد عبر الطبقة المركزية (Claude) بتعليمات الإسداد الصارمة
  const llm = await callCentralProvider({
    systemPrompt: buildGroundingSystemPrompt(),
    userPrompt: buildGroundedUserPrompt(q, context),
    maxTokens: 900,
  });
  const generated = llm.ok && Boolean(llm.content.trim());
  const answer = generated
    ? llm.content.trim()
    : "عُرضت المصادر القانونية ذات الصلة أدناه (الذكاء المركزي غير مُفعّل — لم يُولَّد نصّ؛ راجع المصادر والاستشهادات).";

  return {
    answer, confidence: context.confidence, grounded: true, generated,
    citations,
    relatedArticles: context.articles.map((a) => ({ id: a.id, title: a.title, reason: a.reason, weight: a.weight })),
    relatedRulings: context.rulings.map((r) => ({ id: r.id, title: r.title, reason: r.reason, weight: r.weight })),
    relatedPrinciples: context.principles.map((p) => ({ id: p.id, title: p.title, reason: p.reason, weight: p.weight })),
    providers: search.providers,
  };
}

export type { LegalContext };
