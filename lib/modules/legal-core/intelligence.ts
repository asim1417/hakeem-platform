// طبقة ذكاء النواة القانونية (المرحلة: مركز التكامل).
// ربط تشغيلي فوق الجداول والخدمات القائمة فقط — لا منطق محرّكات جديد، لا تعديل schema.
// كل استعلام مغلّف بأمان: تعذّر القاعدة/غياب الجداول لا يكسر الصفحة، يؤول لحالة واضحة.
import { prisma } from "@/lib/prisma";

export interface IntelligenceSummary {
  systemsCount: number;
  articlesCount: number;
  rulingsCount: number;
  classificationsCount: number;
  linkedArticlesCount: number;
  unlinkedArticlesCount: number;
  unlinkedRulingsCount: number;
  reviewNeededCount: number;
  relationsCount: number;
  linkCoveragePercent: number;
  dataQualityScore: number;
  rulingsImportedButUnlinked: boolean; // تحذير: أحكام مستوردة لكنها غير مرتبطة
}

export function computeDataQualityScore(parts: {
  articlesCount: number;
  linkedArticlesCount: number;
  reviewNeededCount: number;
}): number {
  const { articlesCount, linkedArticlesCount, reviewNeededCount } = parts;
  if (articlesCount <= 0) return 0;
  const coverage = Math.min(1, linkedArticlesCount / articlesCount);
  const reviewOk = Math.max(0, 1 - reviewNeededCount / articlesCount);
  return Math.round((coverage * 0.5 + reviewOk * 0.5) * 1000) / 10;
}

export async function getIntelligenceSummary(): Promise<IntelligenceSummary> {
  const [articlesCount, rulingsCount, systemsCount, classifications, reviewNeededCount, linkedGroups, unlinkedRulingsCount, relationsCount] =
    await Promise.all([
      prisma.legalArticle.count().catch(() => 0),
      prisma.judicialCase.count().catch(() => 0),
      prisma.legalSystem.count().catch(() => 0),
      prisma.legalArticle.groupBy({ by: ["classification"], _count: { _all: true } }).catch(() => [] as { classification: string | null }[]),
      prisma.legalArticle
        .count({ where: { OR: [{ classification: null }, { chapter: null }, { keywords: { isEmpty: true } }] } })
        .catch(() => 0),
      prisma.legalArticleCaseLink.groupBy({ by: ["articleId"], _count: { _all: true } }).catch(() => [] as { articleId: string }[]),
      prisma.judicialCase.count({ where: { articleLinks: { none: {} } } }).catch(() => 0),
      prisma.legalRelation.count().catch(() => 0),
    ]);

  const classificationsCount = classifications.filter((c) => c.classification).length;
  const linkedArticlesCount = linkedGroups.length;
  const unlinkedArticlesCount = Math.max(0, articlesCount - linkedArticlesCount);
  const linkCoveragePercent = articlesCount > 0 ? Math.round((linkedArticlesCount / articlesCount) * 1000) / 10 : 0;
  const dataQualityScore = computeDataQualityScore({ articlesCount, linkedArticlesCount, reviewNeededCount });

  return {
    systemsCount,
    articlesCount,
    rulingsCount,
    classificationsCount,
    linkedArticlesCount,
    unlinkedArticlesCount,
    unlinkedRulingsCount,
    reviewNeededCount,
    relationsCount,
    linkCoveragePercent,
    dataQualityScore,
    rulingsImportedButUnlinked: rulingsCount > 0 && linkedArticlesCount === 0,
  };
}

// ───────────────────────── أزرار التشغيل الذكي (دالّة نقيّة قابلة للاختبار) ─────────────────────────

export interface ArticleContext {
  articleId: string;
  systemName: string;
  articleNumber: number | string;
  articleText: string;
  citation: string;
}

export type SmartActionKind = "navigate" | "clipboard" | "engine" | "data";

export interface SmartAction {
  key: string;
  label: string;
  kind: SmartActionKind;
  href?: string;
  clipboard?: string;
  api?: string;
  method?: "POST";
  payload?: Record<string, unknown>;
}

/** يبني السياق الموحّد للمادة. */
export function buildArticleCitation(systemName: string, articleNumber: number | string): string {
  return `${systemName} — المادة (${articleNumber})`;
}

/** يبني أزرار التشغيل الذكي بحمولات تطابق contracts الـAPIs القائمة (دون تغييرها). */
export function buildArticleActions(ctx: ArticleContext): SmartAction[] {
  const head = `${ctx.systemName} — المادة (${ctx.articleNumber})`;
  const facts = `${head}:\n${ctx.articleText}`.trim();
  return [
    { key: "open", label: "فتح المادة", kind: "navigate", href: `/dashboard/legal-core/articles/${ctx.articleId}` },
    { key: "copy", label: "نسخ الاستشهاد", kind: "clipboard", clipboard: ctx.citation },
    {
      key: "ask",
      label: "اسأل حكيم عن هذه المادة",
      kind: "engine",
      api: "/api/legal-rag",
      method: "POST",
      payload: { question: `ما تفسير وتطبيق ${head}؟\n${ctx.articleText}`.slice(0, 1900) },
    },
    {
      key: "analyze",
      label: "حلّل قضية بناءً على هذه المادة",
      kind: "engine",
      api: "/api/case-analysis",
      method: "POST",
      payload: { facts: facts.slice(0, 7900) },
    },
    {
      key: "strategy",
      label: "أنشئ استراتيجية دعوى",
      kind: "engine",
      api: "/api/legal-agent",
      method: "POST",
      payload: { caseFacts: facts.slice(0, 7900) },
    },
    {
      key: "simulate",
      label: "شغّل محاكاة قضائية",
      kind: "engine",
      api: "/api/judicial-simulation",
      method: "POST",
      payload: { caseFacts: facts.slice(0, 7900) },
    },
    { key: "rulings", label: "اعرض الأحكام المرتبطة", kind: "data" },
    { key: "relations", label: "اعرض العلاقات المعرفية", kind: "data" },
  ];
}

// ───────────────────────── ذكاء مادة مفردة ─────────────────────────

export interface ArticleIntelligence {
  found: boolean;
  article: { id: string; systemName: string; articleNumber: number | string; title: string; content: string; classification: string | null } | null;
  citation: string;
  relatedRulings: { id: string; title: string; court: string | null; relationType: string; confidence: number | null }[];
  relatedPrinciples: { id: string; title: string; principleText: string }[];
  relations: { id: string; sourceType: string; targetType: string; relation: string; strength: number }[];
  availableActions: SmartAction[];
}

export async function getArticleIntelligence(articleId: string): Promise<ArticleIntelligence> {
  let article: ArticleIntelligence["article"] = null;
  try {
    const row = await prisma.legalArticle.findUnique({
      where: { id: articleId },
      select: { id: true, lawName: true, articleNumber: true, title: true, content: true, classification: true },
    });
    if (row) {
      article = {
        id: row.id,
        systemName: row.lawName,
        articleNumber: row.articleNumber,
        title: row.title,
        content: row.content,
        classification: row.classification,
      };
    }
  } catch {
    article = null;
  }

  if (!article) {
    return { found: false, article: null, citation: "", relatedRulings: [], relatedPrinciples: [], relations: [], availableActions: [] };
  }

  const citation = buildArticleCitation(article.systemName, article.articleNumber);

  const [relatedRulings, relations] = await Promise.all([
    prisma.legalArticleCaseLink
      .findMany({
        where: { articleId },
        include: { judicialCase: { select: { id: true, judgmentTitle: true, court: true, caseNo: true, decisionNo: true } } },
        take: 25,
      })
      .then((links) =>
        links.map((l) => ({
          id: l.judicialCase.id,
          title: l.judicialCase.judgmentTitle ?? `حكم ${l.judicialCase.decisionNo ?? l.judicialCase.caseNo ?? l.judicialCase.id}`,
          court: l.judicialCase.court,
          relationType: l.relationType,
          confidence: l.confidence,
        }))
      )
      .catch(() => [] as ArticleIntelligence["relatedRulings"]),
    prisma.legalRelation
      .findMany({
        where: { OR: [{ sourceType: "article", sourceId: articleId }, { targetType: "article", targetId: articleId }] },
        take: 25,
      })
      .then((rows) =>
        rows.map((r) => ({ id: r.id, sourceType: r.sourceType, targetType: r.targetType, relation: String(r.relation), strength: r.strength }))
      )
      .catch(() => [] as ArticleIntelligence["relations"]),
  ]);

  const rulingIds = relatedRulings.map((r) => r.id);
  const relatedPrinciples = rulingIds.length
    ? await prisma.judicialPrinciple
        .findMany({ where: { sourceCaseId: { in: rulingIds } }, select: { id: true, title: true, principleText: true }, take: 25 })
        .then((rows) => rows.map((p) => ({ id: p.id, title: p.title, principleText: p.principleText })))
        .catch(() => [] as ArticleIntelligence["relatedPrinciples"])
    : [];

  const availableActions = buildArticleActions({
    articleId: article.id,
    systemName: article.systemName,
    articleNumber: article.articleNumber,
    articleText: article.content,
    citation,
  });

  return { found: true, article, citation, relatedRulings, relatedPrinciples, relations, availableActions };
}
