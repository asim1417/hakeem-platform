import { prisma } from "@/lib/prisma";
import {
  type ArabicSearchType,
  buildArabicSearchVariants,
  findRootCandidates,
  getArabicStem,
  normalizeArabicText
} from "./arabic-morphology";
import { cosineSimilarity, embedText, parseStoredEmbedding, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";

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
  /** عدد كلمات الاستعلام المتمايزة ذات المعنى الموجودة فعلاً في المادة (لتقدير الصلة) */
  conceptCoverage: number;
  /** عدد عبارات الاستعلام المتجاورة (bigrams) الموجودة كعبارة متّصلة في المادة (أقوى دليل صلة) */
  phraseMatches: number;
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
  /**
   * يُلزم بتغطية مفاهيم متعددة للأسئلة الطبيعية متعددة الكلمات:
   * يستبعد المواد التي تطابق مفهوماً واحداً شائعاً فقط (مثل «العمل» في مادة تعدين).
   * اختياري (افتراضي معطّل) كي لا يتأثر البحث المفرد القائم في الواجهات الأخرى.
   */
  requireConceptCoverage?: boolean;
  /**
   * يفعّل إعادة الترتيب الدلالي (Embeddings) لأعلى المرشّحين: يطابق المعنى لا الحروف
   * فيتجاوز اختلاف الصرف والمرادفات. سقوط آمن للترتيب المعجمي عند غياب المفتاح/المتجهات.
   */
  semantic?: boolean;
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

/**
 * يختار مجموعة مرشّحين متنوّعة الأنظمة من مسحٍ خفيف (id + lawName) بأسلوب round-robin:
 * يأخذ مادة من كل نظام في كل جولة (حتى perSystemCap لكل نظام) قبل أن يأخذ ثانيةً من
 * أيّ نظام — فيمنح **كل نظام مطابق** تمثيلاً قبل أن يهيمن نظام، حتى يبلغ target.
 * يكسر الانحياز الأبجدي واحتكار نظام واحد. نقيّة وقابلة للاختبار.
 */
export function selectDiverseCandidateIds(
  rows: Array<{ id: string; lawName: string }>,
  opts: { perSystemCap: number; target: number }
): string[] {
  // تجميع حسب النظام مع حفظ ترتيب الظهور وتطبيق سقف لكل نظام.
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    let g = groups.get(row.lawName);
    if (!g) {
      g = [];
      groups.set(row.lawName, g);
    }
    if (g.length < opts.perSystemCap) g.push(row.id);
  }

  // round-robin: الجولة k تأخذ المادة رقم k من كل نظام يملكها.
  const selected: string[] = [];
  const buckets = [...groups.values()];
  const maxLen = buckets.reduce((m, g) => Math.max(m, g.length), 0);
  for (let round = 0; round < maxLen && selected.length < opts.target; round += 1) {
    for (const g of buckets) {
      if (round < g.length) {
        selected.push(g[round]);
        if (selected.length >= opts.target) break;
      }
    }
  }
  return selected;
}

/** مقياس مزج التشابه الدلالي مع درجة الصلة المعجمية (cosine 0..1 → إضافة على الدرجة). */
export const SEMANTIC_BLEND_SCALE = 80;

/**
 * يمزج درجة الصلة المعجمية مع التشابه الدلالي: نتيجة دلالية بحتة (lexical≈0) بتشابه
 * معقول تتجاوز عتبة الإسناد فتظهر؛ والمطابقة المعجمية القوية تبقى في القمة. نقيّة.
 */
export function blendSemanticScore(lexicalScore: number, cosine: number, scale: number = SEMANTIC_BLEND_SCALE): number {
  const sem = cosine > 0 ? Math.round(Math.max(0, Math.min(1, cosine)) * scale) : 0;
  return lexicalScore + sem;
}

/**
 * استرجاع دلالي عبر كل الأنظمة من جدول pgvector «embeddings» (فهرس HNSW):
 * يعيد خريطة articleId → تشابه (cosine). قراءة فقط، وسقوط آمن إلى Map فارغة
 * إن غاب الجدول/الامتداد أو تعذّر التضمين.
 */
async function semanticArticleScores(query: string, take: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const vec = await embedText(query.trim());
  if (!vec || vec.length === 0) return out;
  const literal = `[${vec.map((x) => Number(x)).join(",")}]`;
  const limit = Math.min(Math.max(take, 1), 200);
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ owner_id: string; score: number }>>(
      `SELECT owner_id, (1 - (embedding <=> '${literal}'::vector)) AS score
       FROM embeddings
       WHERE owner_type = 'article' AND embedding IS NOT NULL
       ORDER BY embedding <=> '${literal}'::vector
       LIMIT ${limit}`
    );
    for (const r of rows) out.set(r.owner_id, Math.max(0, Math.min(1, Number(r.score))));
  } catch {
    return new Map<string, number>(); // جدول المتجهات غير مُفعّل → بلا استرجاع دلالي
  }
  return out;
}

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
  // كلمات المفاهيم: كلمات المستخدم المتمايزة ذات المعنى (لقياس تغطية الصلة وإعادة الترتيب)
  const conceptWords = Array.from(new Set(rawWords.map(normalizeArabicText))).filter((w) => w.length >= 3);
  // عبارات المفاهيم المتجاورة (bigrams): كل كلمتين متتاليتين ذواتي معنى في الاستعلام الأصلي،
  // مثل «عقد العمل» و«حقوق العامل» — وجودها كعبارة متّصلة دليل صلة قوي جداً.
  const conceptBigrams = buildConceptBigrams(query);

  const where: Record<string, unknown> = {
    AND: [
      buildSystemFilter(options.systemIds),
      buildCategoryFilter(options.categoryIds),
      buildSourceTypeFilter(options.sourceTypes),
      buildTextFilter(filterVariants, fields)
    ].filter((item) => Object.keys(item).length > 0)
  };

  // نجلب مجموعة مرشّحين متنوّعة الأنظمة ثم نرتّبها بالصلة في الذاكرة قبل الاقتطاع.
  // المشكلة سابقاً: جلب أول CAP مادة **أبجدياً باسم النظام** كان يُقصي الأنظمة
  // متأخّرة الترتيب أبجدياً، ويسمح لنظام واحد كثير المواد باحتكار المجموعة —
  // فلا تظهر إلا أنظمة قليلة (قياس التشخيص: ~12% فقط). الحل: مسح خفيف (id+اسم)
  // ثم اختيار متنوّع بسقف لكل نظام، ثم جلب النصوص الكاملة للمختارين فقط.
  const LIGHT_SCAN = 6000;        // مسح خفيف (id + lawName) يغطّي كل المطابقات تقريباً
  const POOL_TARGET = 1200;       // حجم مجموعة المرشّحين الكاملة بعد التنويع
  const PER_SYSTEM_POOL_CAP = 80; // أقصى مواد لكل نظام (≥ أقصى حجم صفحة، فلا تنقص نتائج الاستعلام أحادي النظام)
  // مرشّحو الاسم/العنوان: عند وجود >CAP مرشّح، الاقتطاع الأبجدي كان يقصي «نظام...» (ن)
  // قبل التقييم. لذا نجلب صراحةً المواد التي يطابق اسمُ نظامها/عنوانُها الاستعلام،
  // فنضمن حضور النظام الأنسب (مثل «نظام الأحوال الشخصية») في مجموعة التقييم.
  const nameWhere = query
    ? {
        AND: [
          buildSystemFilter(options.systemIds),
          buildCategoryFilter(options.categoryIds),
          buildSourceTypeFilter(options.sourceTypes),
          buildTextFilter(filterVariants, ["systemTitle", "title"])
        ].filter((item) => Object.keys(item).length > 0)
      }
    : null;

  // تطابق العبارة الكاملة في الاسم/العنوان: أقوى إشارة وأندر مطابقة، فلا يُقصى بالاقتطاع.
  // يضمن حضور النظام صاحب الاسم المطابق تماماً (مثل «نظام العمل») رغم شيوع كلمة «نظام».
  const trimmedQuery = query.trim();
  const phraseNameWhere = trimmedQuery.length >= 3
    ? {
        AND: [
          buildSystemFilter(options.systemIds),
          buildCategoryFilter(options.categoryIds),
          buildSourceTypeFilter(options.sourceTypes),
          { OR: [{ lawName: { contains: trimmedQuery, mode: "insensitive" as const } }, { title: { contains: trimmedQuery, mode: "insensitive" as const } }] }
        ].filter((item) => Object.keys(item).length > 0)
      }
    : null;

  const [total, lightRows, nameCandidates, phraseCandidates] = await Promise.all([
    prisma.legalArticle.count({ where }),
    // مسح خفيف (id + lawName فقط) — رخيص حتى عند آلاف المطابقات.
    prisma.legalArticle
      .findMany({ where, select: { id: true, lawName: true }, orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }], take: LIGHT_SCAN })
      .catch(() => [] as Array<{ id: string; lawName: string }>),
    nameWhere
      ? prisma.legalArticle
          .findMany({
            where: nameWhere,
            include: { legalSystem: { select: { id: true, name: true } } },
            orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
            take: 400
          })
          .catch(() => [])
      : Promise.resolve([]),
    phraseNameWhere
      ? prisma.legalArticle
          .findMany({
            where: phraseNameWhere,
            include: { legalSystem: { select: { id: true, name: true } } },
            orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
            take: 200
          })
          .catch(() => [])
      : Promise.resolve([])
  ]);

  // اختيار متنوّع بسقف لكل نظام، ثم جلب النصوص الكاملة للمختارين فقط (يكسر الاحتكار والانحياز الأبجدي).
  const diverseIds = selectDiverseCandidateIds(lightRows, { perSystemCap: PER_SYSTEM_POOL_CAP, target: POOL_TARGET });
  const candidates = diverseIds.length
    ? await prisma.legalArticle
        .findMany({ where: { id: { in: diverseIds } }, include: { legalSystem: { select: { id: true, name: true } } } })
        .catch(() => [] as Awaited<ReturnType<typeof prisma.legalArticle.findMany>>)
    : [];

  // دمج مع إزالة التكرار: تطابق العبارة الكاملة أولاً، ثم الاسم/العنوان، ثم العام
  const byId = new Map<string, (typeof candidates)[number]>();
  for (const a of phraseCandidates as typeof candidates) byId.set(a.id, a);
  for (const a of nameCandidates as typeof candidates) if (!byId.has(a.id)) byId.set(a.id, a);
  for (const a of candidates) if (!byId.has(a.id)) byId.set(a.id, a);

  // استرجاع دلالي عبر **كل الأنظمة** (HNSW على جدول embeddings): يجلب مواد قريبة
  // بالمعنى حتى بلا تطابق لفظي، فيكسر حصر النتائج في الأنظمة التي تحوي الكلمة حرفياً.
  // سقوط آمن: إن غاب جدول المتجهات تبقى semMap فارغة ويعمل البحث المعجمي كالسابق.
  let semMap = new Map<string, number>();
  if (query && options.semantic && semanticSearchEnabled()) {
    semMap = await semanticArticleScores(query, 60).catch(() => new Map<string, number>());
    const extraIds = [...semMap.keys()].filter((id) => !byId.has(id));
    if (extraIds.length) {
      const extra = await prisma.legalArticle
        .findMany({ where: { id: { in: extraIds } }, include: { legalSystem: { select: { id: true, name: true } } } })
        .catch(() => [] as typeof candidates);
      for (const a of extra as typeof candidates) if (!byId.has(a.id)) byId.set(a.id, a);
    }
  }

  const scored = Array.from(byId.values())
    .map((article) => mapArticleResult(article as LegalArticleWithSystem, query, searchType, normalizedVariants, options, conceptWords, conceptBigrams))
    .map((r) => (semMap.size ? { ...r, relevanceScore: blendSemanticScore(r.relevanceScore, semMap.get(r.articleId) ?? 0) } : r))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  // عند وجود استعلام: نُبقي فقط النتائج ذات الصلة الحقيقية (تطابق مصطلح ذي معنى)؛
  // وإلا نعيد رسالة عدم العثور بدل عرض مواد عشوائية.
  const MIN_RELEVANCE = 12;
  let relevant = query ? scored.filter((result) => result.relevanceScore >= MIN_RELEVANCE) : scored;

  // فلتر تغطية المفاهيم (اختياري): للأسئلة الطبيعية متعددة الكلمات نشترط تطابق
  // مفهومين متمايزين على الأقل، فتُستبعد المطابقات أحادية المفهوم الشائع غير ذات الصلة.
  if (query && options.requireConceptCoverage && conceptWords.length >= 3) {
    const required = Math.min(2, conceptWords.length);
    // أفضلية قصوى للمواد التي تطابق عبارة متجاورة (أقوى دليل صلة)؛
    const phraseHits = relevant.filter((result) => result.phraseMatches > 0);
    if (phraseHits.length) {
      relevant = phraseHits;
    } else {
      const covered = relevant.filter((result) => result.conceptCoverage >= required);
      // لا نُفرغ النتائج تماماً: إن أزال الفلتر كل شيء نُبقي الترتيب الأصلي (الأعلى صلة)
      if (covered.length) relevant = covered;
    }
  }

  // احتياطي: إن تعذّر الاسترجاع الدلالي (جدول المتجهات غائب) نُعيد الترتيب دلالياً
  // على متجهات legal_articles.embedding داخل التطبيق — يطابق المعنى لا الحروف.
  if (query && options.semantic && semMap.size === 0) {
    relevant = await applySemanticRerank(query, relevant).catch(() => relevant);
  }

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

/**
 * إعادة ترتيب أعلى المرشّحين المعجميين بالتشابه الدلالي (cosine) مع متجه الاستعلام.
 * سقوط آمن في كل خطوة: غياب التفعيل/المفتاح/المتجهات → يُعاد الترتيب المعجمي كما هو.
 */
async function applySemanticRerank(query: string, results: LegalCoreResult[]): Promise<LegalCoreResult[]> {
  if (!semanticSearchEnabled() || results.length < 2) return results;
  const queryVec = await embedText(query);
  if (!queryVec) return results;

  const POOL = 80; // نعيد ترتيب أعلى 80 فقط (حدّ التكلفة)؛ الباقي يبقى بترتيبه
  const pool = results.slice(0, POOL);
  const rest = results.slice(POOL);

  const rows = await prisma.legalArticle.findMany({
    where: { id: { in: pool.map((r) => r.articleId) } },
    select: { id: true, embedding: true }
  });
  const vecById = new Map<string, number[]>();
  for (const row of rows) {
    const v = parseStoredEmbedding(row.embedding);
    if (v) vecById.set(row.id, v);
  }
  if (vecById.size === 0) return results; // لا متجهات بعد (لم يُشغّل الـ backfill) → معجمي

  const scored = pool.map((r) => ({ r, sim: vecById.has(r.articleId) ? cosineSimilarity(queryVec, vecById.get(r.articleId)!) : -1 }));
  const withVec = scored.filter((s) => s.sim >= 0).sort((a, b) => b.sim - a.sim).map((s) => s.r);
  const withoutVec = scored.filter((s) => s.sim < 0).map((s) => s.r);
  return [...withVec, ...withoutVec, ...rest];
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

// يبني عبارات متجاورة (bigrams) من كل كلمتين متتاليتين ذواتي معنى في الاستعلام الأصلي.
// يحترم الترتيب والتجاور: «حقوق العامل»، «عقد العمل» — ويتخطّى ما يفصله حرف وقف.
function buildConceptBigrams(query: string): string[] {
  const words = (query ?? "").split(/\s+/).map((w) => w.trim()).filter(Boolean);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    const a = normalizeArabicText(words[i]);
    const b = normalizeArabicText(words[i + 1]);
    if (a.length < 3 || b.length < 3) continue;
    if (ARABIC_STOPWORDS.has(a) || ARABIC_STOPWORDS.has(b)) continue;
    bigrams.push(`${a} ${b}`);
  }
  return Array.from(new Set(bigrams));
}

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

export async function findRelevantLegalArticles(query: string, options: { systemId?: string; category?: string; topic?: string; limit?: number; requireConceptCoverage?: boolean; semantic?: boolean } = {}): Promise<LegalCoreResult[]> {
  const response = await searchLegalCore({
    query: [query, options.topic].filter(Boolean).join(" "),
    systemIds: options.systemId ? [options.systemId] : undefined,
    categoryIds: options.category ? [options.category] : undefined,
    searchType: "derivatives",
    limit: options.limit ?? 8,
    includeMatchedParagraphs: true,
    includeSnippets: true,
    includeRelatedTerms: true,
    requireConceptCoverage: options.requireConceptCoverage,
    semantic: options.semantic
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
  // مسار الذكاء: نُلزم بتغطية المفاهيم + إعادة ترتيب دلالي (عند التفعيل) لمنع تسرّب مواد غير ذات صلة
  const articles = await findRelevantLegalArticles(query, { limit: options.limit ?? 8, requireConceptCoverage: true, semantic: true });
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
  options: AdvancedLegalSearchOptions,
  conceptWords: string[] = [],
  conceptBigrams: string[] = []
): LegalCoreResult {
  const systemName = article.legalSystem?.name ?? article.lawName;
  const haystack = [article.lawName, article.title, article.content, article.classification, article.chapter, article.keywords.join(" ")].filter(Boolean).join("\n");
  const normalizedHaystack = normalizeArabicText(haystack);
  const matchedTerms = normalizedVariants.filter((term) => term.length > 1 && normalizedHaystack.includes(term)).slice(0, 20);
  const matchedParagraphs = options.includeMatchedParagraphs ? extractMatchedParagraphs(article.content, matchedTerms.length ? matchedTerms : [query]) : [];
  const snippet = options.includeSnippets === false ? article.content.slice(0, 450) : buildSnippet(article.content, matchedTerms[0] ?? query);
  // تغطية المفاهيم: كم كلمة من كلمات المستخدم المتمايزة وردت فعلاً في المادة
  const conceptCoverage = conceptWords.filter((w) => normalizedHaystack.includes(w)).length;
  // مطابقة العبارات المتجاورة: أقوى دليل صلة (عبارة قانونية متّصلة لا كلمات متناثرة)
  const phraseMatches = conceptBigrams.filter((bg) => normalizedHaystack.includes(bg)).length;
  // المكافأة: ترفع ترتيب المواد التي تغطي مفاهيم أكثر وتطابق عبارات متّصلة
  // (عامة وآمنة — لا تحذف نتائج). أوزان تصاعدية تكافئ العبارة بقوة.
  const coverageBonus =
    conceptCoverage * 14 +
    (conceptWords.length >= 2 && conceptCoverage >= conceptWords.length ? 20 : 0) +
    phraseMatches * 40;

  // ترجيح قوي لتطابق اسم النظام/عنوان المادة: فالأنسب (مثل «نظام الأحوال الشخصية»)
  // يجب أن يتفوّق على ورود الكلمة العابر في نصوص أنظمة أخرى طويلة.
  const normName = normalizeArabicText(`${systemName} ${article.lawName ?? ""}`);
  const normTitle = normalizeArabicText(article.title ?? "");
  const nq = normalizeArabicText(query);
  let titleBonus = 0;
  if (query && nq.length >= 3) {
    if (normName.includes(nq)) titleBonus += 120; // عبارة الاستعلام كاملة في اسم النظام (أقوى إشارة)
    titleBonus += conceptWords.filter((w) => normName.includes(w)).length * 30; // تغطية المفاهيم في الاسم
    if (normTitle.includes(nq)) titleBonus += 40; // عبارة كاملة في عنوان المادة
    titleBonus += conceptWords.filter((w) => normTitle.includes(w)).length * 12;
    // ترجيح مبدئي للنظام الأصلي فوق لائحته/آليّته (التشريع الأعلى) عند تساوي تطابق الاسم
    if (titleBonus > 0 && normName.trim().startsWith("نظام")) titleBonus += 18;
  }

  const relevanceScore = scoreArticle(haystack, matchedTerms, query) + coverageBonus + titleBonus;

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
    snippet,
    conceptCoverage,
    phraseMatches
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
