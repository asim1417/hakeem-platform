import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  type ArabicSearchType,
  buildArabicSearchVariants,
  findRootCandidates,
  getArabicStem,
  normalizeArabicText
} from "./arabic-morphology";

// إسقاط خفيف للترتيب الكامل (بلا نصّ المادة `content`): يكفي العنوان/الاسم/التصنيف/
// الكلمات المفتاحية للتهديف على مستوى النظام، فيُرتَّب آلاف المطابقات بنقلٍ خفيف.
const LIGHT_ARTICLE_SELECT = {
  id: true,
  lawName: true,
  legalSystemId: true,
  articleNumber: true,
  title: true,
  classification: true,
  chapter: true,
  keywords: true,
  status: true,
  legalSystem: { select: { id: true, name: true } }
} satisfies Prisma.LegalArticleSelect;

type LightArticle = Prisma.LegalArticleGetPayload<{ select: typeof LIGHT_ARTICLE_SELECT }>;
import { cosineSimilarity, embedText, parseStoredEmbedding, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";
import { matchConcepts, systemMatchesPreferred } from "./concept-map";
import { expandToken } from "./lexicon-expansion";
import { getArticleAuthorityMap } from "./authority";
import { getFiqhIssuesForArticle } from "./fiqh-issues";
import { matchThesaurusConcepts, thesaurusGraphExpansion } from "@/lib/modules/legal-thesaurus/concept-index";
import { getOpenSearchConfig, openSearchHeaders } from "@/lib/modules/legal-search/providers/search-provider";

export const noLegalArticleMessage = "لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.";

export type LegalCoreResult = {
  articleId: string;
  systemName: string;
  systemId: string | null;
  articleNumber: number;
  articleTitle: string;
  articleText: string;
  classification: string | null;
  status: string | null;
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
  /** عدد الأحكام القضائية المستشهِدة بهذه المادة (شفافية سلطة للعرض — لا يؤثّر في الترتيب) */
  citationCount?: number;
};

export type AdvancedLegalSearchOptions = {
  query?: string;
  searchType?: ArabicSearchType;
  categoryIds?: string[];
  systemIds?: string[];
  /** فلترة اختيارية بمجال النظام المصنّف (legal_systems.domain) — لا تؤثر إن لم تُمرَّر. */
  domain?: string;
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
  /**
   * يفعّل إشارة OpenSearch (BM25 بمحلّل عربي + ترجيح التغطية الكاملة) كإشارة خامسة في النواة.
   * افتراضياً مُفعّلة حين يُضبَط العنقود (كِلّ-سويتش: CORE_OPENSEARCH=0). سقوط آمن عند غيابه.
   */
  openSearch?: boolean;
};

export type AdvancedLegalSearchResponse = {
  query: string;
  searchType: ArabicSearchType;
  total: number;
  /** هل رُتِّبت **كل** المطابقات (استرجاع كامل)؟ false فقط للاستعلامات شديدة الاتساع (> COMPLETE_CAP). */
  exhaustive?: boolean;
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
 * يختار مجموعة مرشّحين متنوّعة الأنظمة من مسحٍ خفيف (id + معرّف النظام) بأسلوب round-robin:
 * يأخذ مادة من كل نظام في كل جولة (حتى perSystemCap لكل نظام) قبل أن يأخذ ثانيةً من
 * أيّ نظام — فيمنح **كل نظام مطابق** تمثيلاً قبل أن يهيمن نظام، حتى يبلغ target.
 * يكسر الانحياز الأبجدي واحتكار نظام واحد. نقيّة وقابلة للاختبار.
 *
 * المرحلة ٢ (تصليب الربط): التجميع يكون على المعرّف الثابت legalSystemId إن وُجد،
 * ويسقط إلى lawName فقط حين يغيب — كي لا تنقسم مواد النظام الواحد عبر تباين نصّ الاسم
 * (OCR/مسافات) فيتضخّم تمثيله؛ هذا جذر «الظهور/الاختفاء».
 */
export function selectDiverseCandidateIds(
  rows: Array<{ id: string; lawName: string; legalSystemId?: string | null }>,
  opts: { perSystemCap: number; target: number }
): string[] {
  // تجميع حسب النظام (بالمعرّف الثابت أولًا) مع حفظ ترتيب الظهور وتطبيق سقف لكل نظام.
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const systemKey = row.legalSystemId ?? row.lawName;
    let g = groups.get(systemKey);
    if (!g) {
      g = [];
      groups.set(systemKey, g);
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
/** عتبة: المطابقات المعجمية الأقوى منها لا تُضخَّم دلالياً (حفظاً للتنوّع)؛ يطابق MIN_RELEVANCE. */
export const SEMANTIC_LEX_FLOOR = 12;
/** ترجيح التشريع الأصلي (نظام) عند تطابق اسمه مع الاستعلام — يتفوّق على لائحته. */
export const PRIMARY_LAW_BONUS = 80;
/** خفض الأداة الثانوية (لائحة/قرار/دليل…) عند تطابق اسمها، فتُرتَّب بعد نظامها الأصل. */
export const SECONDARY_INSTRUMENT_PENALTY = -25;
/**
 * ترجيح النظام المعنيّ بمفهوم الاستعلام (مثل براءات الاختراع لـ«الملكية الفكرية»).
 * رُفع ليتغلّب على مكافآت تطابق الاسم (PRIMARY_LAW_BONUS + عنوان) على نظام هامشي
 * يحوي الكلمة في اسمه (مثل «صندوق النفقة»/«الطيران المدني») — فيفوز النظام الأصل (المعاملات/الأحوال).
 */
export const CONCEPT_SYSTEM_BONUS = 170;
/** أقصى عدد مواد تُجلب من مواضع المكنز ولم يجدها البحث المعجمي (استرجاع مُسنَد). */
const THESAURUS_OCC_PULL_LIMIT = 50;
/**
 * وزن إشارة OpenSearch (BM25 بمحلّل عربي) على درجة الصلة: إضافيّ [0..OPENSEARCH_BOOST_SCALE].
 * مُعايَر ليعيد الترتيب بوضوح دون أن يطغى على تطابق العبارة (phraseMatches*40) — فمادة
 * تطابق **كل** كلمات الاستعلام في OpenSearch ترتفع، ومادة الكلمة الشائعة وحدها لا. */
export const OPENSEARCH_BOOST_SCALE = 30;
/** أقصى عدد مواد تُجلب من OpenSearch ولم يجدها المسار المعجمي داخل القاعدة (استرجاع مُسنَد). */
const OPENSEARCH_PULL_LIMIT = 60;

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

/**
 * إشارة OpenSearch للنواة (الخامسة): يستعلم فهرس legal_articles بمحلّل عربي (BM25) مع
 * ترجيح «التغطية الكاملة» (operator:"and") — فترتفع المادة التي تحوي **كل** كلمات
 * الاستعلام فوق ما يحوي كلمة شائعة وحدها (يعالج «فسخ العقود» ← ضريبة الدخل). يعيد
 * خريطة معرّف المادة ← درجة مُطبَّعة [0..1]. مقصور على النوع «article» ليطابق نطاق النواة.
 * سقوط آمن إلى Map فارغة عند غياب الإعداد/تعذّر الاتصال (لا يكسر البحث أبداً).
 */
async function openSearchArticleScores(query: string, take: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const q = query.trim();
  if (!q) return out;
  const cfg = getOpenSearchConfig();
  if (!cfg) return out;
  const size = Math.min(Math.max(take, 1), 200);
  const body = {
    size,
    _source: ["id", "articleId"],
    query: {
      bool: {
        // النوع «article» فقط — النواة مقصورة على المواد (الأحكام/المبادئ لاحقًا).
        filter: [{ term: { type: "article" } }],
        must_not: [{ term: { status: "needs_review" } }],
        should: [
          // تغطية كاملة عالية الوزن (نفس إصلاح «فسخ»).
          { match: { title: { query: q, operator: "and", boost: 8 } } },
          { match: { content: { query: q, operator: "and", boost: 6 } } },
          // [طبقة العبارات] الحقل الفرعي .phrase (عبارات متلاصقة) — غير ضارّ على الفهرس القديم.
          { match: { "title.phrase": { query: q, boost: 6 } } },
          { match: { "content.phrase": { query: q, boost: 5 } } },
          // مطابقة جزئية (OR) للاسترجاع الواسع.
          { match: { title: { query: q, boost: 3 } } },
          { match: { content: { query: q, boost: 2 } } },
          { match: { "content.exact": { query: q, boost: 4 } } },
          { match: { lawName: { query: q } } }
        ],
        minimum_should_match: 1
      }
    }
  };
  try {
    const res = await fetch(`${cfg.url}/${cfg.indexArticles}/_search`, {
      method: "POST",
      headers: openSearchHeaders(cfg),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3500)
    });
    if (!res.ok) return out;
    const data = (await res.json()) as {
      hits?: { max_score?: number; hits?: Array<{ _score?: number; _source?: Record<string, unknown> }> };
    };
    const hits = data.hits?.hits ?? [];
    const maxScore = data.hits?.max_score || 1;
    for (const h of hits) {
      const src = h._source ?? {};
      const id = String(src.id ?? src.articleId ?? "");
      if (!id) continue;
      out.set(id, Math.max(0, Math.min(1, (h._score ?? 0) / maxScore)));
    }
  } catch {
    return new Map<string, number>(); // OpenSearch غير متاح → النواة تعمل بإشاراتها الأربع.
  }
  return out;
}

/** يبني كلمات استعلام tsquery مفردة مُطبَّعة (نفس تطبيع search_norm) من متغيّرات البحث. */
function buildTsQueryWords(variants: string[]): string[] {
  const words = new Set<string>();
  for (const v of variants) {
    for (const w of normalizeArabicText(v).split(/\s+/)) {
      if (w.length >= 2) words.add(w);
    }
  }
  return [...words].slice(0, 40);
}

/**
 * استدعاء مفهرس داخل القاعدة: يطابق النصّ العربي المُطبَّع (search_norm) عبر فهرس GIN
 * (tsvector('simple')) ويرتّب بـ ts_rank_cd — بدل عشرات ILIKE على أعمدة خام. يعالج
 * «التطبيع وقت الاستعلام» (صور الهمزة/التاء المربوطة تُطابَق) ويسرّع الاسترجاع.
 * يعيد صفوفاً خفيفة (بلا نصّ، بلا ضمّ legalSystem → systemName يسقط إلى lawName).
 * سقوط آمن إلى null عند غياب العمود/الفهرس أو أي خطأ (فيعود المسار المعجمي).
 */
async function inDbLightCandidates(words: string[], cap: number): Promise<LightArticle[] | null> {
  if (!words.length) return null;
  const tsq = words.join(" | ");
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        lawName: string;
        legalSystemId: string | null;
        articleNumber: number;
        title: string;
        classification: string | null;
        chapter: string | null;
        keywords: string[];
        status: string;
      }>
    >(
      // ملاحظة: التعبير هنا **يطابق حرفيًّا** تعبير فهرس GIN
      // (idx_legal_articles_search_norm_tsv على to_tsvector('simple', coalesce(search_norm,'')))
      // وإلا فمطابقة Postgres البنيوية تفشل ويقع مسح تسلسليّ كامل (~13× أبطأ — مُثبَت بـ EXPLAIN).
      `SELECT id, "lawName", "legalSystemId", "articleNumber", title, classification, chapter, keywords, status
       FROM legal_articles
       WHERE search_norm IS NOT NULL
         AND to_tsvector('simple', coalesce(search_norm, '')) @@ to_tsquery('simple', $1)
       ORDER BY ts_rank_cd(to_tsvector('simple', coalesce(search_norm, '')), to_tsquery('simple', $1)) DESC
       LIMIT ${cap}`,
      tsq
    );
    return rows.map((r) => ({ ...r, legalSystem: null })) as unknown as LightArticle[];
  } catch {
    return null; // العمود/الفهرس غير موجود، أو خطأ tsquery → سقوط آمن للمسار المعجمي
  }
}

export async function searchLegalCore(options: AdvancedLegalSearchOptions = {}): Promise<AdvancedLegalSearchResponse> {
  const query = (options.query ?? "").trim();
  const searchType = options.searchType ?? "contains";
  const page = Math.max(Number(options.page ?? 1), 1);
  // سقف الصفحة 200 (كان 80): يتيح سحب دفعات أكبر عند تصدير «كامل النتائج».
  const limit = Math.min(Math.max(Number(options.limit ?? 20), 1), 200);
  const fields = normalizeFields(options.fields);
  // استبعاد الكلمات القصيرة/الشائعة حتى لا تطابق مواد لا صلة لها بالبحث
  const baseVariants = filterMeaningfulVariants(buildVariants(query, searchType));
  // ربط مفاهيمي: نوسّع البحث بمرادفات المفهوم (مثل «الملكية الفكرية» ← براءات/حقوق المؤلف)
  // ونرجّح الأنظمة المعنيّة — يحلّ حالة المفهوم الذي لا يحوي اسمُ نظامه مصطلحَ الاستعلام.
  const concept = matchConcepts(query);
  // مكنز حكيم (2,967 مفهوماً): توسيع معجمي مُسنَد لمعرّفات حقيقية — يكمّل الخريطة المنسّقة.
  const thesaurus = await matchThesaurusConcepts(query);
  // توسيع رسومي: مفاهيم مرتبطة (للمصطلحات) + ترجيح المواد عبر المواضع (معتمدة، موزونة).
  const graph = thesaurus.conceptIds.length
    ? await thesaurusGraphExpansion(thesaurus.conceptIds)
    : { relatedLabels: [] as string[], articleBoosts: new Map<string, number>() };
  const preferSystems = concept.preferSystems;
  // توسيع صرفيّ من المعجم الرسميّ (hoqoqi): صيغ شقيقة بنفس الجذر. خلف علمٍ افتراضيّه OFF
  // حتى يُقاس أثره بـ eval:search قبل الاعتماد (انضباط القياس-قبل-الاعتماد).
  const lexiconSynonyms = process.env.LEXICON_EXPANSION === "1"
    ? Array.from(new Set(query.split(/\s+/).flatMap((w) => expandToken(w.trim(), 6))))
    : [];
  const variants = Array.from(
    new Set([...baseVariants, ...concept.synonyms, ...thesaurus.synonyms, ...graph.relatedLabels, ...lexiconSynonyms])
  );
  const normalizedVariants = Array.from(new Set(variants.map(normalizeArabicText).filter(Boolean)));
  // الكلمات الخام من الاستعلام (كما يكتبها المستخدم) — تطابق النص المخزَّن غير المُطبَّع (ة/ى/إ)
  const rawWords = query
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !ARABIC_STOPWORDS.has(normalizeArabicText(word)));
  // مُرشِّح قاعدة البيانات يبحث بالصيغتين: المُطبَّعة + الخام
  const filterVariants = Array.from(new Set([...rawWords, ...variants]));
  // «مطابق» (exact): العبارة المتّصلة كما كُتبت فقط — بلا تفكيك كلمات ولا توسيع مفاهيم/صرف،
  // فتُطابَق حرفيًّا متّصلةً عبر ILIKE (لا OR على الكلمات).
  const dbFilterVariants = searchType === "exact" ? [query] : filterVariants;
  // كلمات المفاهيم: كلمات المستخدم المتمايزة ذات المعنى (لقياس تغطية الصلة وإعادة الترتيب)
  const conceptWords = Array.from(new Set(rawWords.map(normalizeArabicText))).filter((w) => w.length >= 3);
  // عبارات المفاهيم المتجاورة (bigrams): كل كلمتين متتاليتين ذواتي معنى في الاستعلام الأصلي،
  // مثل «عقد العمل» و«حقوق العامل» — وجودها كعبارة متّصلة دليل صلة قوي جداً.
  const conceptBigrams = buildConceptBigrams(query);

  const where: Record<string, unknown> = {
    AND: [
      buildSystemFilter(options.systemIds),
      buildDomainFilter(options.domain),
      buildCategoryFilter(options.categoryIds),
      buildSourceTypeFilter(options.sourceTypes),
      buildTextFilter(dbFilterVariants, fields)
    ].filter((item) => Object.keys(item).length > 0)
  };

  // ════════════════════════════════════════════════════════════════════════
  // استرجاع كامل (Complete Retrieval) بمرحلتين — كما في المحرّكات العالمية:
  //   ① استدعاء + ترتيب **كل** المطابقات على إسقاط خفيف (بلا نصّ المادة): اسم النظام +
  //      العنوان + التصنيف + الفصل + الكلمات المفتاحية + الرقم. نمرّر content="" لـ
  //      mapArticleResult فيعتمد إشارات الاسم/العنوان/المفهوم/الدلالي (تكفي للترتيب على
  //      مستوى النظام). فيظهر «كامل النتائج» (لو ألف نتيجة) ويعمل الترقيم العميق، بنقلٍ خفيف.
  //   ② تجسيد الصفحة المطلوبة فقط (≤ limit): جلب النصّ الكامل لبناء المقتطف/الفقرات —
  //      فلا يُنقل نصّ أيّ مادة غير معروضة (كان سابقاً يجلب نصّ 2000 مادة لكل استعلام).
  // يزيل اقتطاع المجموعة (2000/80) ويُبلّغ الإجماليّ الحقيقي بصدق.
  // ════════════════════════════════════════════════════════════════════════
  const COMPLETE_CAP = 20000; // ≥ الكوربوس: ترتيب كامل لأي استعلام واقعي (الإسقاط خفيف فالكلفة محدودة)

  // مسار الاستدعاء المفهرس داخل القاعدة (tsvector): للاستعلام النصّي البسيط بلا فلاتر بنيوية
  // (النظام/المجال/التصنيف/المصدر/تقييد الحقول) — إذ يجمع search_norm كل الحقول. مع أي فلتر
  // بنيوي أو تعطيله بـ IN_DB_RECALL=0 نعود للمسار المعجمي (ILIKE) دون تغيير سلوك.
  const noStructuralFilter =
    !cleanList(options.systemIds).length &&
    !cleanList(options.categoryIds).length &&
    !options.domain &&
    (!cleanList(options.sourceTypes).length ||
      (cleanList(options.sourceTypes).length === 1 && cleanList(options.sourceTypes)[0] === "article")) &&
    fields.length === Object.keys(searchableFieldMap).length;
  // «مطابق» يُستثنى من المسار المفهرس (tsvector يفكّك الكلمات بـOR) ليبقى التطابق متّصلًا عبر ILIKE.
  const useInDb = Boolean(query) && noStructuralFilter && searchType !== "exact" && process.env.IN_DB_RECALL !== "0";

  let total = 0;
  let lightRows: LightArticle[] = [];
  const inDbRows = useInDb ? await inDbLightCandidates(buildTsQueryWords(dbFilterVariants), COMPLETE_CAP) : null;
  if (inDbRows) {
    // كل المطابقات (< السقف) رُجِّعت مفهرسةً — الإجماليّ الحقيقي = طولها؛ التطبيق يعيد ترتيبها.
    lightRows = inDbRows;
    total = inDbRows.length;
  } else {
    // المسار المعجمي (ILIKE) — مع الفلاتر البنيوية أو عند تعذّر المسار المفهرس.
    const [t, rows] = await Promise.all([
      prisma.legalArticle.count({ where }).catch(() => 0),
      prisma.legalArticle
        .findMany({ where, select: LIGHT_ARTICLE_SELECT, orderBy: { id: "asc" }, take: COMPLETE_CAP })
        .catch(() => [] as LightArticle[])
    ]);
    total = t;
    lightRows = rows;
  }
  // exhaustive=false فقط إن تجاوزت المطابقات السقف (مستحيل بالكوربوس الحالي) — ترقيم غير مكتمل عندئذٍ.
  const exhaustive = total <= COMPLETE_CAP;

  const lightById = new Map<string, LightArticle>();
  for (const r of lightRows) lightById.set(r.id, r);

  // مواد مُسنَدة من مواضع المكنز لم يطابقها النصّي — استرجاع مُسنَد (المفهوم يرد فيها فعلاً).
  if (graph.articleBoosts.size) {
    const missingOccIds = [...graph.articleBoosts.keys()].filter((id) => !lightById.has(id)).slice(0, THESAURUS_OCC_PULL_LIMIT);
    if (missingOccIds.length) {
      const extraOcc = await prisma.legalArticle
        .findMany({ where: { id: { in: missingOccIds } }, select: LIGHT_ARTICLE_SELECT })
        .catch(() => [] as LightArticle[]);
      for (const r of extraOcc) if (!lightById.has(r.id)) lightById.set(r.id, r);
    }
  }

  // استرجاع دلالي عبر **كل الأنظمة** (HNSW على جدول embeddings): معرّفات + تشابه (بلا نصّ)،
  // فيجلب مواد قريبة بالمعنى حتى بلا تطابق لفظي. سقوط آمن إلى Map فارغة إن غاب الجدول.
  let semMap = new Map<string, number>();
  if (query && options.semantic && semanticSearchEnabled()) {
    semMap = await semanticArticleScores(query, 200).catch(() => new Map<string, number>());
    const extraIds = [...semMap.keys()].filter((id) => !lightById.has(id));
    if (extraIds.length) {
      const extra = await prisma.legalArticle
        .findMany({ where: { id: { in: extraIds } }, select: LIGHT_ARTICLE_SELECT })
        .catch(() => [] as LightArticle[]);
      for (const r of extra) if (!lightById.has(r.id)) lightById.set(r.id, r);
    }
  }

  // إشارة OpenSearch (الخامسة): BM25 بمحلّل عربي + ترجيح التغطية الكاملة (إصلاح «فسخ»).
  // مُفعّلة افتراضياً حين يُضبَط العنقود (كِلّ-سويتش CORE_OPENSEARCH=0 أو options.openSearch=false).
  // تجلب أيضاً مواداً قوية لم يجدها المسار المعجمي داخل القاعدة (استرجاع مُسنَد). سقوط آمن تام.
  let osMap = new Map<string, number>();
  const osEnabled = query && options.openSearch !== false && process.env.CORE_OPENSEARCH !== "0";
  if (osEnabled) {
    osMap = await openSearchArticleScores(query, 200).catch(() => new Map<string, number>());
    if (osMap.size) {
      const extraIds = [...osMap.keys()].filter((id) => !lightById.has(id)).slice(0, OPENSEARCH_PULL_LIMIT);
      if (extraIds.length) {
        const extra = await prisma.legalArticle
          .findMany({ where: { id: { in: extraIds } }, select: LIGHT_ARTICLE_SELECT })
          .catch(() => [] as LightArticle[]);
        for (const r of extra) if (!lightById.has(r.id)) lightById.set(r.id, r);
      }
    }
  }

  // التهديف الخفيف: content="" + إيقاف المقتطف/الفقرات (تُبنى لاحقاً للصفحة فقط).
  const lightOptions: AdvancedLegalSearchOptions = { ...options, includeSnippets: false, includeMatchedParagraphs: false };
  const scored = Array.from(lightById.values())
    .map((row) => mapArticleResult({ ...row, content: "" } as unknown as LegalArticleWithSystem, query, searchType, normalizedVariants, lightOptions, conceptWords, conceptBigrams, preferSystems))
    // ترجيح المكنز: مادة يرد فيها مفهوم مُطابَق (معتمد) تُرفع درجتها بمقدار مُسنَد للمواضع.
    .map((r) => {
      const boost = graph.articleBoosts.get(r.articleId);
      return boost ? { ...r, relevanceScore: r.relevanceScore + boost } : r;
    })
    // إشارة OpenSearch **إضافيّة**: ترجيح BM25 مُطبَّع [0..1] × السقف. مادة التغطية الكاملة
    // («فسخ»+«عقد» معاً) تنال درجة عالية فترتفع؛ مادة الكلمة الشائعة وحدها تنال درجة ضعيفة.
    .map((r) => {
      if (!osMap.size) return r;
      const os = osMap.get(r.articleId) ?? 0;
      return os > 0 ? { ...r, relevanceScore: r.relevanceScore + Math.round(os * OPENSEARCH_BOOST_SCALE) } : r;
    })
    // الدلالي **إضافي لا إزاحي**: نرفع فقط المواد الضعيفة/الدلالية البحتة (lexical < العتبة)
    // كي تظهر أنظمة لم يجدها النصّي، دون تضخيم المطابقات المعجمية القوية (الذي يركّز على
    // نظام المجال ويزيح التنوّع). فيزيد التغطية بدل أن يقلّصها.
    .map((r) => {
      if (!semMap.size) return r;
      const cos = semMap.get(r.articleId) ?? 0;
      if (cos === 0 || r.relevanceScore >= SEMANTIC_LEX_FLOOR) return r;
      return { ...r, relevanceScore: blendSemanticScore(r.relevanceScore, cos) };
    })
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

  // الإجماليّ: عند الاسترجاع الكامل (exhaustive) = عدد النتائج ذات الصلة فعلاً (رُتِّبت كلها).
  // عند المسار الاحتياطي شديد الاتساع نُبلّغ الإجماليّ الحقيقي من القاعدة (count) بصدق،
  // ونعلّم exhaustive=false كي تعرف الواجهة أن ما بعد المجموعة المرتّبة غير مضمون الترتيب.
  const effectiveTotal = query ? (exhaustive ? relevant.length : Math.max(relevant.length, total)) : total;
  const start = (page - 1) * limit;
  const pageSlice = relevant.slice(start, start + limit);
  // ② تجسيد الصفحة: نجلب النصّ الكامل لمواد الصفحة فقط (≤ limit) لبناء المقتطف/الفقرات،
  //    مع الحفاظ على ترتيب ودرجات المرحلة ① (لا إعادة ترتيب عبر الصفحات).
  const results = await materializePage(pageSlice, query, searchType, normalizedVariants, options, conceptWords, conceptBigrams, preferSystems);

  // شفافية السلطة (عرض فقط، لا ترتيب): نُرفق عدد الأحكام المستشهِدة بكل مادة في الصفحة —
  // «مُستشهَد بها في N حكماً». عدّ حقيقي من روابط المادة↔الحكم؛ يحكم المحامي على المرجعية.
  // مقصور على صفّ الصفحة (≤ limit)، خريطة مُذكّرة، سقوط آمن إلى بلا شارة. مُبدَّل بـ CITING_REFERENCES=0.
  const citationMap =
    results.length && process.env.CITING_REFERENCES !== "0"
      ? await getArticleAuthorityMap().catch(() => new Map<string, number>())
      : null;
  const displayResults = citationMap
    ? results.map((r) => {
        const count = citationMap.get(r.articleId);
        return count ? { ...r, citationCount: count } : r;
      })
    : results;

  return {
    query,
    searchType,
    total: effectiveTotal,
    exhaustive,
    page,
    limit,
    relatedTerms: options.includeRelatedTerms ? variants.slice(0, 24) : [],
    results: displayResults,
    message: effectiveTotal ? undefined : noLegalArticleMessage
  };
}

/**
 * المرحلة ② للاسترجاع الكامل: تجسيد صفحة النتائج بنصّها الكامل.
 * تجلب الصفوف الكاملة لمواد الصفحة فقط (≤ limit) وتبني النتيجة النهائية (مقتطف + فقرات)،
 * مع الحفاظ على درجة وترتيب المرحلة ① (التهديف الخفيف) لثبات الترقيم عبر الصفحات.
 * سقوط آمن: مادة تعذّر جلبها كاملةً تبقى بنتيجتها الخفيفة.
 */
async function materializePage(
  pageSlice: LegalCoreResult[],
  query: string,
  searchType: ArabicSearchType,
  normalizedVariants: string[],
  options: AdvancedLegalSearchOptions,
  conceptWords: string[],
  conceptBigrams: string[],
  preferSystems: string[]
): Promise<LegalCoreResult[]> {
  if (!pageSlice.length) return [];
  const ids = pageSlice.map((r) => r.articleId);
  const fullRows = await prisma.legalArticle
    .findMany({ where: { id: { in: ids } }, include: { legalSystem: { select: { id: true, name: true } } } })
    .catch(() => [] as Awaited<ReturnType<typeof prisma.legalArticle.findMany>>);
  const fullById = new Map(fullRows.map((a) => [a.id, a]));
  return pageSlice.map((light) => {
    const full = fullById.get(light.articleId);
    if (!full) return light; // سقوط آمن: أبقِ النتيجة الخفيفة
    const display = mapArticleResult(full as LegalArticleWithSystem, query, searchType, normalizedVariants, options, conceptWords, conceptBigrams, preferSystems);
    // حافظ على درجة المرحلة ① (الترتيب الكامل) كي يبقى الترقيم متّسقاً عبر الصفحات.
    return { ...display, relevanceScore: light.relevanceScore };
  });
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

// كلمات «مؤهِّلة» عامة شائعة في أسماء الأنظمة (تجاري/مالي/إداري/حماية/مكافحة...): تتكرّر عبر
// أنظمة كثيرة فلا تميّز الموضوع. تُخفَّض في مكافأة الاسم (IDF مبسّط منسّق يدوياً) كي تسود
// الكلمة الجوهرية النادرة (التحكيم/الإفلاس/البيئة/التستر) فيتصدّر النظام الأنسب لا نظامٌ يتشارك
// كلمة عامة (مثل «المحاكم التجارية» لـ«التحكيم»). تطبيع مسبق ليطابق صيغ الاستعلام المطبَّعة.
const GENERIC_SYSTEM_NAME_WORDS = new Set<string>([
  "التجاري","التجارية","المالي","المالية","الاداري","الادارية","العامة","العام",
  "الموحد","الموحدة","التنفيذية","التنفيذي","العسكرية","العسكري","الوطني","الوطنية",
  "السعودي","السعودية","العربي","العربية","مكافحة","حماية","الخدمة"
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
    related: related.filter((item) => item.articleId !== article.id),
    fiqhIssues: getFiqhIssuesForArticle(article.lawName, article.articleNumber)
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
  // الجذر/الاشتقاق: أوضاعٌ صرفيّة يختارها المستخدم صراحةً — نُثريها بصيَغ شقيقة **حقيقية**
  // من معجم hoqoqi (expandToken) إضافةً إلى المرشّحات الحدسيّة. لا تمسّ الوضع الافتراضي (contains).
  if (searchType === "root") return [query, ...findRootCandidates(query), ...expandToken(query, 8), ...buildArabicSearchVariants(query, "root")];
  if (searchType === "derivatives") return [query, ...expandToken(query, 8), ...buildArabicSearchVariants(query, "derivatives")];
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

// فلترة اختيارية بمجال النظام المصنّف — عبر علاقة legalSystem.domain.
function buildDomainFilter(domain?: string) {
  const d = domain?.trim();
  if (!d) return {};
  return { legalSystem: { domain: d } };
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
  conceptBigrams: string[] = [],
  preferSystems: string[] = []
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
    // تغطية المفاهيم في الاسم: الكلمة الجوهرية (النادرة) تُرجَّح ×30، والكلمة العامة المؤهِّلة
    // (التجاري/المالي/حماية...) ×6 فقط — فلا يتعادل «التجاري» العام مع «التحكيم» الجوهري.
    for (const w of conceptWords) {
      if (normName.includes(w)) titleBonus += GENERIC_SYSTEM_NAME_WORDS.has(w) ? 6 : 30;
    }
    if (normTitle.includes(nq)) titleBonus += 40; // عبارة كاملة في عنوان المادة
    for (const w of conceptWords) {
      if (normTitle.includes(w)) titleBonus += GENERIC_SYSTEM_NAME_WORDS.has(w) ? 3 : 12;
    }
    // ترجيح قوي للتشريع الأصلي (نظام) فوق لائحته/أداته الثانوية — فقط عند تطابق الاسم:
    // يمنع تصدّر «اللائحة التنفيذية لضبط أعمال تفتيش العمل» على «نظام العمل» لاستعلام «العمل».
    if (titleBonus > 0) {
      const trimmedName = normName.trim();
      if (trimmedName.startsWith("نظام")) {
        titleBonus += PRIMARY_LAW_BONUS; // تشريع أصلي
      } else if (/^(اللائحة|لائحة|تنظيم|قرار|تعميم|الدليل|دليل|آلية|قواعد|ضوابط)/.test(trimmedName)) {
        titleBonus += SECONDARY_INSTRUMENT_PENALTY; // أداة ثانوية تابعة لنظام (تُرتَّب بعده)
      }
    }
  }

  // ترجيح مفاهيمي: النظام المعنيّ بمفهوم الاستعلام (مثل براءات الاختراع لـ«الملكية الفكرية»)
  // يُرفع فوق لائحة تحوي العبارة عرضاً — مستقلّ عن تطابق اسم النظام مع الاستعلام.
  const conceptBonus2 = preferSystems.length && systemMatchesPreferred(systemName, preferSystems) ? CONCEPT_SYSTEM_BONUS : 0;

  // [تخفيض التغطية] المشكلة: التردّد العالي لكلمة شائعة (مثل «عقد») يراكم درجة خام تطغى على
  // المادة التي تغطّي **كل** مفاهيم الاستعلام. لاستعلام «فسخ العقود» تفوز ضريبة الدخل (تكرّر
  // «عقد» بلا «فسخ») على مادة الفسخ. الحلّ: تخفيض الدرجة الخام (term-frequency) بنسبة تغطية
  // مفاهيم الاستعلام — فمادة تفوّت مفهوماً مميِّزاً (فسخ) تُخفَّض بقوة مهما تكرّر المفهوم العام.
  // مقصور على الاستعلامات متعددة المفاهيم؛ التغطية الكاملة = بلا تخفيض. كِلّ-سويتش COVERAGE_DAMP=0.
  const coverageRatio = conceptWords.length >= 2 ? conceptCoverage / conceptWords.length : 1;
  const rawDamp = process.env.COVERAGE_DAMP === "0" ? 1 : Math.max(0.3, coverageRatio);
  const relevanceScore = scoreArticle(haystack, matchedTerms, query) * rawDamp + coverageBonus + titleBonus + conceptBonus2;

  return {
    articleId: article.id,
    systemName,
    systemId: article.legalSystemId,
    articleNumber: article.articleNumber,
    articleTitle: article.title,
    articleText: article.content,
    classification: article.classification,
    status: article.status,
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
