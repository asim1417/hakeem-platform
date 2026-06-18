// بنّاء السياق القانوني: يحوّل نتائج البحث الهجين + علاقات الرسم المعرفي
// + الكيانات القائمة إلى سياق منظّم وموزون للـ LLM. إزالة تكرار + ترتيب + ترجيح.

export interface RagArticle {
  id: string;
  title: string;
  content: string;
  lawName: string;
  articleNumber: number;
  score: number;
  reason: string;
}
export interface RagRuling {
  id: string;
  title: string;
  text: string;
  caseNo: string | null;
  decisionNo: string | null;
  court: string | null;
  score: number;
  reason: string;
}
export interface RagPrinciple {
  id: string;
  title: string;
  text: string;
  score: number;
  reason: string;
}
export interface RagRelation {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relation: string;
  strength: number;
}

export interface ContextSource {
  type: "article" | "ruling" | "principle";
  id: string;
  title: string;
  weight: number;
  reason: string;
}

export interface LegalContext {
  articles: (RagArticle & { weight: number })[];
  rulings: (RagRuling & { weight: number })[];
  principles: (RagPrinciple & { weight: number })[];
  relations: RagRelation[];
  confidence: number;
  sources: ContextSource[];
}

const LINK_BOOST = 0.15;

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** يبني السياق القانوني الموزون من المكوّنات. */
export function buildLegalContext(input: {
  question: string;
  articles: RagArticle[];
  rulings: RagRuling[];
  principles: RagPrinciple[];
  relations: RagRelation[];
}): LegalContext {
  const articles = dedupeById(input.articles);
  const rulings = dedupeById(input.rulings);
  const principles = dedupeById(input.principles);
  const relations = dedupeById(input.relations);

  const articleIds = new Set(articles.map((a) => a.id));

  // مادة مرتبطة مباشرة بالسؤال → وزنها = درجتها من البحث
  const weightedArticles = articles
    .map((a) => ({ ...a, weight: clamp(a.score) }))
    .sort((x, y) => y.weight - x.weight);

  // حكم مرتبط بمادة حاضرة (عبر العلاقات) → ترجيح
  const isLinkedTo = (entityId: string, presentIds: Set<string>) =>
    relations.some(
      (r) =>
        (r.sourceId === entityId && presentIds.has(r.targetId)) ||
        (r.targetId === entityId && presentIds.has(r.sourceId))
    );

  const weightedRulings = rulings
    .map((r) => ({ ...r, weight: clamp(r.score + (isLinkedTo(r.id, articleIds) ? LINK_BOOST : 0)) }))
    .sort((x, y) => y.weight - x.weight);

  const rulingIds = new Set(weightedRulings.map((r) => r.id));

  // مبدأ مرتبط بحكم حاضر → ترجيح
  const weightedPrinciples = principles
    .map((p) => ({ ...p, weight: clamp(p.score + (isLinkedTo(p.id, rulingIds) ? LINK_BOOST : 0)) }))
    .sort((x, y) => y.weight - x.weight);

  // قائمة المصادر مرتّبة حسب الوزن
  const sources: ContextSource[] = [
    ...weightedArticles.map((a) => ({ type: "article" as const, id: a.id, title: a.title, weight: a.weight, reason: a.reason })),
    ...weightedRulings.map((r) => ({ type: "ruling" as const, id: r.id, title: r.title, weight: r.weight, reason: r.reason })),
    ...weightedPrinciples.map((p) => ({ type: "principle" as const, id: p.id, title: p.title, weight: p.weight, reason: p.reason })),
  ].sort((x, y) => y.weight - x.weight);

  // ثقة السياق = متوسط أوزان أعلى ٥ مصادر
  const top = sources.slice(0, 5);
  const confidence = top.length
    ? Math.round((top.reduce((s, x) => s + x.weight, 0) / top.length) * 1000) / 1000
    : 0;

  return {
    articles: weightedArticles,
    rulings: weightedRulings,
    principles: weightedPrinciples,
    relations,
    confidence,
    sources,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}
