import { prisma } from "@/lib/prisma";
import {
  type ArabicSearchType,
  buildArabicSearchVariants,
  findRootCandidates,
  getArabicStem,
  normalizeArabicText
} from "./arabic-morphology";

export const noLegalArticleMessage = "لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.";

export type LegalCoreResult = {
  articleId: string;
  systemName: string;
  systemId: string | null;
  articleNumber: number;
  articleTitle: string;
  articleText: string;
  classification: string | null;
  chapter: string | null;
  relevanceReason: string;
  citationLabel: string;
  internalUrl: string;
  relevanceScore: number;
  matchedTerms: string[];
  matchedParagraphs: string[];
  matchType: ArabicSearchType | "general";
  snippet: string;
};

export type AdvancedLegalSearchOptions = {
  query?: string;
  searchType?: ArabicSearchType;
  categoryIds?: string[];
  systemIds?: string[];
  sourceTypes?: string[];
  fields?: string[];
  page?: number;
  limit?: number;
  includeSnippets?: boolean;
  includeMatchedParagraphs?: boolean;
  includeRelatedTerms?: boolean;
};

export type AdvancedLegalSearchResponse = {
  query: string;
  searchType: ArabicSearchType;
  total: number;
  page: number;
  limit: number;
  relatedTerms: string[];
  message?: string;
  results: LegalCoreResult[];
};

type LegalArticleWithSystem = Awaited<ReturnType<typeof prisma.legalArticle.findFirst>> & {
  legalSystem?: { id: string; name: string } | null;
};

const searchableFieldMap = {
  systemTitle: "lawName",
  articleNumber: "articleNumber",
  title: "title",
  content: "content",
  keywords: "keywords",
  classification: "classification"
} as const;

export async function searchLegalCore(options: AdvancedLegalSearchOptions = {}): Promise<AdvancedLegalSearchResponse> {
  const query = (options.query ?? "").trim();
  const searchType = options.searchType ?? "contains";
  const page = Math.max(Number(options.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(options.limit ?? 20), 1), 80);
  const fields = normalizeFields(options.fields);
  // استبعاد الكلمات القصيرة/الشائعة حتى لا تطابق مواد لا صلة لها بالبحث
  const variants = filterMeaningfulVariants(buildVariants(query, searchType));
  const normalizedVariants = Array.from(new Set(variants.map(normalizeArabicText).filter(Boolean)));
  // الكلمات الخام من الاستعلام (كما يكتبها المستخدم) — تطابق النص المخزَّن غير المُطبَّع (ة/ى/إ)
  const rawWords = query
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !ARABIC_STOPWORDS.has(normalizeArabicText(word)));
  // مُرشِّح قاعدة البيانات يبحث بالصيغتين: المُطبَّعة + الخام
  const filterVariants = Array.from(new Set([...rawWords, ...variants]));

  const where: Record<string, unknown> = {
    AND: [
      buildSystemFilter(options.systemIds),
      buildCategoryFilter(options.categoryIds),
      buildSourceTypeFilter(options.sourceTypes),
      buildTextFilter(filterVariants, fields)
    ].filter((item) => Object.keys(item).length > 0)
  };

  // نجلب مجموعة مرشّحين كبيرة ثم نرتّبها بالصلة في الذاكرة قبل الاقتطاع،
  // لأن الترتيب الأبجدي + take(limit) في قاعدة البيانات كان يُرجع مواد غير ذات صلة.
  const CANDIDATE_CAP = 600;
  const [total, candidates] = await Promise.all([
    prisma.legalArticle.count({ where }),
    prisma.legalArticle.findMany({
      where,
      include: { legalSystem: { select: { id: true, name: true } } },
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: CANDIDATE_CAP
    })
  ]);

  const scored = candidates
    .map((article) => mapArticleResult(article as LegalArticleWithSystem, query, searchType, normalizedVariants, options))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  // عند وجود استعلام: نُبقي فقط النتائج ذات الصلة الحقيقية (تطابق مصطلح ذي معنى)؛
  // وإلا نعيد رسالة عدم العثور بدل عرض مواد عشوائية.
  const MIN_RELEVANCE = 12;
  const relevant = query ? scored.filter((result) => result.relevanceScore >= MIN_RELEVANCE) : scored;

  const effectiveTotal = query ? relevant.length : total;
  const start = (page - 1) * limit;
  const results = relevant.slice(start, start + limit);

  return {
    query,
    searchType,
    total: effectiveTotal,
    page,
    limit,
    relatedTerms: options.includeRelatedTerms ? variants.slice(0, 24) : [],
    results,
    message: effectiveTotal ? undefined : noLegalArticleMessage
  };
}

// بحث مباشر بالرقم للتحقق من وجود مادة مذكورة في الحكم (دقيق — لا يعتمد المطابقة النصية).
export async function getArticlesByNumber(articleNumber: number, systemHint?: string): Promise<LegalCoreResult[]> {
  if (!Number.isFinite(articleNumber) || articleNumber <= 0) return [];
  const where: Record<string, unknown> = { articleNumber };
  const hint = (systemHint ?? "").replace(/^من\s+/, "").trim();
  if (hint) {
    where.OR = [
      { lawName: { contains: hint, mode: "insensitive" } },
      { legalSystem: { is: { name: { contains: hint, mode: "insensitive" } } } }
    ];
  }
  const articles = await prisma.legalArticle.findMany({
    where,
    include: { legalSystem: { select: { id: true, name: true } } },
    take: 12
  });
  return articles.map((article) => mapArticleResult(article as LegalArticleWithSystem, "", "contains", [], { includeSnippets: true }));
}

// قائمة كلمات شائعة لا تميّز موضوع البحث (إجرائية/عامة) — تُستبعد من مطابقة الصلة.
// تُطبَّع عند الإنشاء (إزالة التشكيل + توحيد الألف/الياء/التاء) لتطابق المتغيّرات المطبَّعة،
// وإلا تسرّبت كلمات مثل «على/إلى» وطابقت كل مادة فأفسدت الترتيب بالصلة.
const ARABIC_STOPWORDS = new Set<string>([
  "من","في","على","عن","الى","إلى","او","أو","ثم","قد","كل","بعد","قبل","عند","هذا","هذه","ذلك","تلك",
  "التي","الذي","الذين","غير","بين","مع","ما","لا","ان","أن","إن","كان","كانت","به","بها","له","لها",
  "هو","هي","هم","نحو","حيث","كما","وقد","وهو","وهي","الا","إلا","اذا","إذا","انه","أنه","انها","عليه","عليها",
  "شركة","مؤسسة","المدعي","المدعى","المدعية","الدعوى","القضية",
  "ريال","ريالا","ريالاً","مبلغ","الحكم","الدائرة","طلب","طلبات","وكيل","ممثل","وهي","وعليه","فيها","عنها"
].map(normalizeArabicText));

function filterMeaningfulVariants(variants: string[]): string[] {
  const meaningful = variants.filter((variant) => {
    const normalized = normalizeArabicText(variant);
    if (normalized.length < 3) return false;
    if (ARABIC_STOPWORDS.has(normalized)) return false;
    return true;
  });
  // إن أزالت التصفية كل شيء (استعلام قصير جداً) نُبقي الأصل لتفادي بحث فارغ
  return meaningful.length ? meaningful : variants;
}

export async function findRelevantLegalArticles(query: string, options: { systemId?: string; category?: string; topic?: string; limit?: number } = {}): Promise<LegalCoreResult[]> {
  const response = await searchLegalCore({
    query: [query, options.topic].filter(Boolean).join(" "),
    systemIds: options.systemId ? [options.systemId] : undefined,
    categoryIds: options.category ? [options.category] : undefined,
    searchType: "derivatives",
    limit: options.limit ?? 8,
    includeMatchedParagraphs: true,
    includeSnippets: true,
    includeRelatedTerms: true
  });

  return response.results;
}

export async function getArticleFullContext(articleId: string) {
  const article = await prisma.legalArticle.findUnique({
    where: { id: articleId },
    include: { legalSystem: true }
  });

  if (!article) return null;

  const related = await findRelevantLegalArticles(article.content.slice(0, 120), {
    systemId: article.legalSystemId ?? article.lawName,
    category: article.classification ?? undefined,
    limit: 6
  });

  return {
    articleId: article.id,
    systemName: article.legalSystem?.name ?? article.lawName,
    articleNumber: article.articleNumber,
    articleTitle: article.title,
    articleText: article.content,
    classification: article.classification,
    chapter: article.chapter,
    status: article.status,
    citationLabel: buildSingleCitationLabel(article.lawName, article.articleNumber),
    related: related.filter((item) => item.articleId !== article.id)
  };
}

export async function buildLegalContextForAI(query: string, options: { limit?: number } = {}) {
  const articles = await findRelevantLegalArticles(query, { limit: options.limit ?? 8 });
  if (articles.length === 0) {
    return {
      hasArticles: false,
      articles,
      citationBlock: noLegalArticleMessage,
      contextText: noLegalArticleMessage
    };
  }

  const citationBlock = buildCitationBlock(articles);
  return {
    hasArticles: true,
    articles,
    citationBlock,
    contextText: [
      "السياق النظامي المسترجع من النواة القانونية الموحدة:",
      citationBlock,
      "قاعدة إلزامية: لا تستشهد إلا بالمواد أعلاه، ولا تخترع مواد أو أرقام مواد."
    ].join("\n")
  };
}

export function buildCitationBlock(articles: LegalCoreResult[]) {
  if (articles.length === 0) return noLegalArticleMessage;
  return articles.map((article) => `- ${article.citationLabel}: ${article.articleText.slice(0, 600)}`).join("\n");
}

function buildSingleCitationLabel(systemName: string, articleNumber: number) {
  return `${systemName}، المادة ${articleNumber}`;
}

function normalizeFields(fields?: string[]) {
  const cleaned = (fields ?? []).filter((field) => field in searchableFieldMap);
  return cleaned.length ? cleaned : ["systemTitle", "articleNumber", "title", "content", "keywords", "classification"];
}

function buildVariants(query: string, searchType: ArabicSearchType) {
  if (!query) return [];
  if (searchType === "exact") return [query];
  if (searchType === "stem") return [query, getArabicStem(query), ...buildArabicSearchVariants(query, "stem")];
  if (searchType === "root") return [query, ...findRootCandidates(query), ...buildArabicSearchVariants(query, "root")];
  return buildArabicSearchVariants(query, searchType);
}

function buildTextFilter(variants: string[], fields: string[]) {
  if (!variants.length) return {};
  const searchValues = variants.slice(0, 36);
  const orFilters: Record<string, unknown>[] = [];

  for (const value of searchValues) {
    if (!value) continue;
    if (fields.includes("content")) orFilters.push({ content: { contains: value, mode: "insensitive" } });
    if (fields.includes("title")) orFilters.push({ title: { contains: value, mode: "insensitive" } });
    if (fields.includes("systemTitle")) orFilters.push({ lawName: { contains: value, mode: "insensitive" } });
    if (fields.includes("classification")) orFilters.push({ classification: { contains: value, mode: "insensitive" } });
    if (fields.includes("keywords")) orFilters.push({ keywords: { has: value } });

    const numeric = Number(value.replace(/[^\d]/g, ""));
    if (fields.includes("articleNumber") && Number.isFinite(numeric) && numeric > 0) {
      orFilters.push({ articleNumber: numeric });
    }
  }

  return orFilters.length ? { OR: orFilters } : {};
}

function buildSystemFilter(systemIds?: string[]) {
  const values = cleanList(systemIds);
  if (!values.length) return {};
  return {
    OR: values.flatMap((value) => [
      { legalSystemId: value },
      { lawName: { contains: value, mode: "insensitive" as const } }
    ])
  };
}

function buildCategoryFilter(categoryIds?: string[]) {
  const values = cleanList(categoryIds);
  if (!values.length) return {};
  return {
    OR: values.map((value) => ({ classification: { contains: value, mode: "insensitive" as const } }))
  };
}

function buildSourceTypeFilter(sourceTypes?: string[]) {
  const values = cleanList(sourceTypes);
  if (!values.length || values.includes("article")) return {};
  if (values.includes("hoqoqi_sql")) {
    return { keywords: { has: "source:hoqoqi_sql" } };
  }
  if (values.includes("judgment") || values.includes("case_link")) {
    return { id: "__no_article_results_for_judgment_source__" };
  }
  return {};
}

function mapArticleResult(
  article: NonNullable<LegalArticleWithSystem>,
  query: string,
  searchType: ArabicSearchType,
  normalizedVariants: string[],
  options: AdvancedLegalSearchOptions
): LegalCoreResult {
  const systemName = article.legalSystem?.name ?? article.lawName;
  const haystack = [article.lawName, article.title, article.content, article.classification, article.chapter, article.keywords.join(" ")].filter(Boolean).join("\n");
  const normalizedHaystack = normalizeArabicText(haystack);
  const matchedTerms = normalizedVariants.filter((term) => term.length > 1 && normalizedHaystack.includes(term)).slice(0, 20);
  const matchedParagraphs = options.includeMatchedParagraphs ? extractMatchedParagraphs(article.content, matchedTerms.length ? matchedTerms : [query]) : [];
  const snippet = options.includeSnippets === false ? article.content.slice(0, 450) : buildSnippet(article.content, matchedTerms[0] ?? query);
  const relevanceScore = scoreArticle(haystack, matchedTerms, query);

  return {
    articleId: article.id,
    systemName,
    systemId: article.legalSystemId,
    articleNumber: article.articleNumber,
    articleTitle: article.title,
    articleText: article.content,
    classification: article.classification,
    chapter: article.chapter,
    relevanceReason: query ? `تطابق ${matchTypeLabel(searchType)} مع: ${query.slice(0, 80)}` : "نتيجة عامة من النواة القانونية.",
    citationLabel: buildSingleCitationLabel(systemName, article.articleNumber),
    internalUrl: `/dashboard/legal-core/articles/${article.id}${query ? `?q=${encodeURIComponent(query)}` : ""}`,
    relevanceScore,
    matchedTerms,
    matchedParagraphs,
    matchType: query ? searchType : "general",
    snippet
  };
}

function extractMatchedParagraphs(content: string, terms: string[]) {
  const normalizedTerms = terms.map(normalizeArabicText).filter(Boolean);
  return content
    .split(/\n+|(?<=\.)\s+|(?<=،)\s+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => {
      const normalized = normalizeArabicText(paragraph);
      return normalizedTerms.some((term) => normalized.includes(term));
    })
    .slice(0, 5);
}

function buildSnippet(content: string, term: string) {
  if (!term) return content.slice(0, 450);
  const normalizedContent = normalizeArabicText(content);
  const normalizedTerm = normalizeArabicText(term);
  const index = normalizedContent.indexOf(normalizedTerm);
  if (index < 0) return content.slice(0, 450);
  const start = Math.max(index - 160, 0);
  return `${start > 0 ? "..." : ""}${content.slice(start, start + 520)}${start + 520 < content.length ? "..." : ""}`;
}

function scoreArticle(text: string, matchedTerms: string[], query: string) {
  if (!query) return 1;
  const normalizedText = normalizeArabicText(text);
  const base = matchedTerms.reduce((score, term) => score + (normalizedText.includes(term) ? 12 : 0), 0);
  return base + (normalizedText.includes(normalizeArabicText(query)) ? 25 : 0);
}

function cleanList(values?: string[]) {
  return (values ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

function matchTypeLabel(searchType: ArabicSearchType) {
  const labels: Record<ArabicSearchType, string> = {
    exact: "مطابق",
    contains: "ضمن النص",
    derivatives: "اشتقاقي",
    root: "بالجذر",
    stem: "بالساق",
    affixes: "بالسوابق واللواحق"
  };
  return labels[searchType];
}
