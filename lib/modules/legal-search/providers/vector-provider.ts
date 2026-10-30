import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";
import { rankByCosine } from "@/lib/modules/legal-search/embedding-fallback";
import { findRelevantLegalArticles } from "@/lib/modules/legal-core/legal-retrieval";
import { latestVectorSource } from "@/lib/modules/legal-search/vector-source";
import { nearestRulingSegments, rulingSegmentVectorsReady } from "@/lib/modules/legal-core/rulings-search";
import { resolveEntity, type EntityType } from "@/lib/modules/knowledge-graph/relations";
import { resolveMinScore, scopedLawIds, wantsType, type LegalEntityType, type RawResult, type SearchProvider, type SearchQuery } from "./search-provider";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";

// مزوّد البحث الدلالي (Semantic). مساران بسقوط آمن:
//   1) جدول pgvector `embeddings` إن كان موجوداً وفيه متجهات (الأسرع، يشمل كل الأنواع).
//   2) احتياطي: متجهات `legal_articles.embedding` (Json) مع حساب التشابه داخل التطبيق
//      على مجموعة مرشّحين معجمية محدودة (لتفادي تحميل كل المتجهات في كل استعلام).
// لا يكتب أي بيانات ولا يجري backfill. أي تعذّر يعيد [] دون كسر البحث.

const FALLBACK_CANDIDATE_POOL = 100; // سقف المرشّحين المعجميين الذين نعيد ترتيبهم دلالياً
// عتبة التشابه الدلالي الدنيا (cosine): أقل منها = بعيد الصلة يُستبعَد كضجيج.
const MIN_SEMANTIC_SCORE = 0.6;

/** هل جدول pgvector `embeddings` متاح وفيه متجهات؟ (وجود صفّ واحد يكفي — لا عدّ لكل الجدول.) */
async function embeddingsTableHasRows(): Promise<boolean> {
  try {
    return (await prisma.embedding.findFirst({ select: { id: true } })) !== null;
  } catch {
    return false; // الجدول/الامتداد غير مُفعّل في قاعدة التشغيل
  }
}

// الفهرس العام على embeddings يخلط الأحكام (70٪) بالمواد والمبادئ، فالترشيح بنوع المالك بعده يُسقط
// أغلب المرشّحين، والاستعلام المجمَّع (latestVectorSource) لا يستعمل الفهرس أصلًا فيمسح كل المتجهات
// (~9 ث باردة). الفهارس الجزئية (migration 20261016200000) تجعل كل نوع بحثًا مفهرسًا مستقلًّا.
export const PARTIAL_HNSW_INDEXES = ["idx_embeddings_hnsw_article", "idx_embeddings_hnsw_principle"] as const;
const PARTIAL_CHECK_TTL_MS = 5 * 60_000;
let partialCheck: { at: number; ready: boolean } | null = null;

/** هل الفهرسان الجزئيان موجودان؟ يُخزَّن الجواب 5 دقائق؛ قبل تطبيق الترحيل يبقى المسار القديم. */
async function partialIndexesReady(): Promise<boolean> {
  if (partialCheck && Date.now() - partialCheck.at < PARTIAL_CHECK_TTL_MS) return partialCheck.ready;
  let ready = false;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ n: number }>>(
      `SELECT count(*)::int AS n FROM pg_indexes WHERE tablename = 'embeddings' AND indexname = ANY($1::text[])`,
      [...PARTIAL_HNSW_INDEXES],
    );
    ready = Number(rows[0]?.n ?? 0) === PARTIAL_HNSW_INDEXES.length;
  } catch {
    ready = false;
  }
  partialCheck = { at: Date.now(), ready };
  return ready;
}

/** للاختبارات: يُسقط جواب فحص الفهرسين المخزَّن. */
export function resetPartialIndexCheck(): void {
  partialCheck = null;
}

type VectorRow = { owner_type: string; owner_id: string; score: number; segment?: true };

/** أقرب متجهات نوعٍ واحد عبر فهرسه الجزئي. الشرط حرفيّ ليطابق شرط الفهرس. */
export function partialTypeSql(type: "article" | "principle", take: number): string {
  return `SELECT e.owner_type, e.owner_id, (1 - (e.embedding <=> $1::vector)) AS score
     FROM embeddings e
     WHERE e.owner_type = '${type}' AND e.embedding IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM embedding_version ev WHERE ev.owner_type = e.owner_type AND ev.owner_id = e.owner_id)
     ORDER BY e.embedding <=> $1::vector
     LIMIT ${take}`;
}

/**
 * الأحكام في الجدول العام. مع متجهات الأجزاء لا يبقى إلا الأحكام التي لا أجزاء لها (12 اليوم):
 * تُعيَّن معرّفاتها أولًا (بلا قراءة متجه) ثم يُحسب البعد لها فقط — «+ 0» يمنع المخطِّط من الفهرس
 * العام الذي يُسقطها. بلا أجزاء: الأحكام أغلب الفهرس العام فالترشيح بعده آمن.
 */
export function rulingsSql(segReady: boolean, take: number): string {
  if (!segReady) {
    return `SELECT e.owner_type, e.owner_id, (1 - (e.embedding <=> $1::vector)) AS score
       FROM embeddings e
       WHERE e.owner_type = 'ruling' AND e.embedding IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM embedding_version ev WHERE ev.owner_type = e.owner_type AND ev.owner_id = e.owner_id)
       ORDER BY e.embedding <=> $1::vector
       LIMIT ${take}`;
  }
  return `WITH orphans AS MATERIALIZED (
       SELECT id FROM embeddings
       WHERE owner_type = 'ruling' AND owner_id NOT IN (SELECT ruling_id FROM ruling_segment_embeddings)
     )
     SELECT e.owner_type, e.owner_id, (1 - (e.embedding <=> $1::vector)) AS score
     FROM embeddings e
     WHERE e.id IN (SELECT id FROM orphans) AND e.embedding IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM embedding_version ev WHERE ev.owner_type = e.owner_type AND ev.owner_id = e.owner_id)
     ORDER BY (e.embedding <=> $1::vector) + 0
     LIMIT ${take}`;
}

/** أحدث نسخة متجه لكل مالك (جدول النسخ صغير — مسح مباشر). */
export function versionsSql(segReady: boolean, take: number): string {
  return `SELECT owner_type, owner_id, (1 - (embedding <=> $1::vector)) AS score
     FROM (
       SELECT owner_type, owner_id, embedding,
              row_number() OVER (PARTITION BY owner_type, owner_id ORDER BY created_at DESC) AS rn
       FROM embedding_version
       WHERE embedding IS NOT NULL
     ) v
     WHERE rn = 1${segReady ? ` AND owner_type <> 'ruling'` : ""}
     ORDER BY embedding <=> $1::vector
     LIMIT ${take}`;
}

/**
 * HKM-053: أقرب مواد أنظمة بعينها. المرشحون معرّفات مواد النظام (عشرات إلى مئات) فيُحسب البعد لها مباشرة
 * («+ 0» يمنع الفهرس العام الذي يرجع أقرب المدونة كلها ثم يسقطها الشرط). أحدث نسخة في embedding_version
 * تتقدم على متجه الجدول العام للمادة نفسها، كما في المسار العام.
 */
export function scopedArticlesSql(take: number): string {
  return `WITH ids AS MATERIALIZED (
       SELECT id FROM legal_articles WHERE "legalSystemId" = ANY($2::text[]) AND "articleBis" < ${NON_ARTICLE_BIS}
     ),
     vecs AS (
       SELECT DISTINCT ON (owner_id) owner_id, embedding FROM (
         SELECT ev.owner_id, ev.embedding, 0 AS pri, ev.created_at FROM embedding_version ev
          WHERE ev.owner_type = 'article' AND ev.embedding IS NOT NULL AND ev.owner_id IN (SELECT id FROM ids)
         UNION ALL
         SELECT e.owner_id, e.embedding, 1 AS pri, NULL::timestamptz FROM embeddings e
          WHERE e.owner_type = 'article' AND e.embedding IS NOT NULL AND e.owner_id IN (SELECT id FROM ids)
       ) x ORDER BY owner_id, pri, created_at DESC NULLS LAST
     )
     SELECT 'article' AS owner_type, owner_id, (1 - (embedding <=> $1::vector)) AS score
     FROM vecs
     ORDER BY (embedding <=> $1::vector) + 0
     LIMIT ${take}`;
}

/**
 * HKM-062: تشابه مواد بعينها مع متجه السؤال (المرشحون من الحصر اللفظي لا من أقرب الجيران). أحدث نسخة في
 * embedding_version تتقدم على متجه الجدول العام، كما في scopedArticlesSql. المعرّفات معامل ($2) لا نص مدموج.
 */
export function articleIdsSimilaritySql(): string {
  return `WITH vecs AS (
       SELECT DISTINCT ON (owner_id) owner_id, embedding FROM (
         SELECT ev.owner_id, ev.embedding, 0 AS pri, ev.created_at FROM embedding_version ev
          WHERE ev.owner_type = 'article' AND ev.embedding IS NOT NULL AND ev.owner_id = ANY($2::text[])
         UNION ALL
         SELECT e.owner_id, e.embedding, 1 AS pri, NULL::timestamptz FROM embeddings e
          WHERE e.owner_type = 'article' AND e.embedding IS NOT NULL AND e.owner_id = ANY($2::text[])
       ) x ORDER BY owner_id, pri, created_at DESC NULLS LAST
     )
     SELECT owner_id, (1 - (embedding <=> $1::vector)) AS score FROM vecs`;
}

/**
 * HKM-062: تشابه المعنى لمرشحين لفظيين (معرّف ← 0..1). نداء التضمين نفسه الذي يجريه البحث الدلالي للنص ذاته
 * (مخزَّن مؤقتًا في embedText)، واستعلام قراءة واحد على المعرّفات. سقوط آمن: خريطة فارغة.
 */
export async function articleSimilarities(q: string, ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const list = [...new Set(ids)].slice(0, 200);
  if (!list.length || !semanticSearchEnabled() || !q.trim()) return out;
  try {
    const vec = await embedText(q.trim());
    if (!vec?.length) return out;
    const literal = `[${vec.map((x) => Number(x)).join(",")}]`;
    const rows = await prisma.$queryRawUnsafe<Array<{ owner_id: string; score: number }>>(articleIdsSimilaritySql(), literal, list);
    for (const r of rows) out.set(r.owner_id, Math.max(0, Math.min(1, Number(r.score))));
  } catch {
    return new Map();
  }
  return out;
}

/** المسار المفهرس: أعلى take لكل مصدر ثم الدمج — اتحادها يحوي أعلى take الكلّي. */
async function nearestViaPartialIndexes(literal: string, take: number, segReady: boolean, want: (t: LegalEntityType) => boolean): Promise<VectorRow[]> {
  const q = (sql: string) => prisma.$queryRawUnsafe<VectorRow[]>(sql, literal);
  const none = Promise.resolve([] as VectorRow[]);
  const batches = await Promise.all([
    want("article") ? q(partialTypeSql("article", take)) : none,
    want("principle") ? q(partialTypeSql("principle", take)) : none,
    // HKM-043: متجه الحكم القديم مبني من النص الخام (وفيه الأسماء)؛ مع متجهات الأجزاء المحجوبة لا يُقرأ أبدًا.
    want("ruling") && !segReady ? q(rulingsSql(false, take)) : none,
    q(versionsSql(segReady, take)),
  ]);
  return batches.flat();
}

/** هل يوجد متجهات على `legal_articles.embedding` (مصدر الاحتياطي)؟ */
async function articleEmbeddingsExist(): Promise<boolean> {
  try {
    const one = await prisma.legalArticle.findFirst({
      where: { embedding: { not: Prisma.AnyNull } },
      select: { id: true },
    });
    return Boolean(one);
  } catch {
    return false;
  }
}

/** المسار الأساسي: استعلام pgvector على جدول `embeddings`. يعيد null إن تعذّر فيُجرَّب الاحتياطي. */
async function searchViaEmbeddingsTable(vec: number[], limit: number, types?: LegalEntityType[], minScore: number = MIN_SEMANTIC_SCORE, lawIds: string[] | null = null): Promise<RawResult[] | null> {
  const want = (t: LegalEntityType) => wantsType({ types }, t);
  if (!(await embeddingsTableHasRows())) return null;
  try {
    const literal = `[${vec.map((x) => Number(x)).join(",")}]`;
    const take = Math.min(limit, 20);
    const t0 = Date.now();
    // الأحكام: متجهات الأسباب والمنطوق (ruling_segment_embeddings، من نص محجوبة أسماؤه) متى وُجدت، بدل متجه
    // الحكم القديم المبني من أول ٨٬٠٠٠ حرف خام (الديباجة والأسماء) — فيُستبعد ذاك كله، ولو لحكم بلا أجزاء.
    const segReady = await rulingSegmentVectorsReady().catch(() => false);
    const sqlFor = (from: string) =>
      `SELECT owner_type, owner_id, (1 - (embedding <=> '${literal}'::vector)) AS score
       FROM ${from}
       WHERE embedding IS NOT NULL${types ? ` AND owner_type IN (${types.map((t) => `'${t}'`).join(",")})` : ""}${segReady ? ` AND owner_type <> 'ruling'` : ""}
       ORDER BY embedding <=> '${literal}'::vector
       LIMIT ${take}`;
    const partial = await partialIndexesReady();
    // HKM-053: مع الحصر بنظام تأتي المواد من استعلامها المحصور، والمسار العام لغيرها فقط (يُتخطى إن لم يُطلب غيرها).
    const scoped = lawIds && want("article");
    const othersWanted = want("principle") || want("ruling");
    const [generalRows, scopedRows, segHits] = await Promise.all([
      scoped && !othersWanted
        ? Promise.resolve([] as VectorRow[])
        : partial
          ? nearestViaPartialIndexes(literal, take, segReady, want)
          : prisma.$queryRawUnsafe<VectorRow[]>(sqlFor(latestVectorSource())).catch(() =>
              prisma.$queryRawUnsafe<VectorRow[]>(sqlFor("embeddings")),
            ),
      scoped ? prisma.$queryRawUnsafe<VectorRow[]>(scopedArticlesSql(take), literal, lawIds) : Promise.resolve([] as VectorRow[]),
      segReady && want("ruling") ? nearestRulingSegments(vec).catch(() => []) : Promise.resolve([]),
    ]);
    const baseRows = lawIds ? [...generalRows.filter((r) => r.owner_type !== "article"), ...scopedRows] : generalRows;
    console.info(`[search] vector sql ms=${Date.now() - t0} path=${partial ? "partial_hnsw" : "scan"}`);
    // عتبة الأحكام من قياس متجهات الأجزاء (RULINGS_SEMANTIC_MIN، 0.42)؛ وعتبة البقية كما هي.
    const segIds = new Set(segHits.map((h) => h.id));
    const rows = [
      ...baseRows.filter((r) => !(r.owner_type === "ruling" && segIds.has(r.owner_id)) && want(r.owner_type as LegalEntityType)),
      ...segHits.slice(0, take).map((h) => ({ owner_type: "ruling", owner_id: h.id, score: h.sim, segment: true })),
    ].sort((x, y) => Number(y.score) - Number(x.score)).slice(0, take);

    // عتبة دنيا للتشابه الدلالي: تمنع ظهور نتائج بعيدة (٣٠٪–٤٠٪) كضجيج.
    // أحكام متجهات الأجزاء صُفّيت بعتبتها المقيسة في nearestRulingSegments.
    const kept = rows.filter((row) => {
      const type = row.owner_type;
      if (type !== "article" && type !== "ruling" && type !== "principle") return false;
      return Math.max(0, Math.min(1, Number(row.score))) >= minScore || "segment" in row;
    });
    // حلّ الكيانات بالتوازي (كان تسلسليًّا: حتى 20 رحلة قاعدة متتالية).
    const entities = await Promise.all(kept.map((row) => resolveEntity(row.owner_type as EntityType, row.owner_id)));
    const results: RawResult[] = [];
    for (const [i, row] of kept.entries()) {
      const type = row.owner_type as EntityType;
      const score = Math.max(0, Math.min(1, Number(row.score)));
      const entity = entities[i];
      if (!entity.exists) continue;
      results.push({
        type: type as LegalEntityType,
        id: row.owner_id,
        title: entity.label,
        score,
        source: "vector",
        reason: `تشابه دلالي (${(score * 100).toFixed(0)}%)`,
        // نمرّر التشابه الخام (cosine) صراحةً كي تُشتقّ الثقة من التشابه الفعلي لا من رتبة RRF (الدفعة ١.٤).
        meta: { matchedBy: "semantic", semanticSource: "segment" in row ? "ruling_segment_embeddings" : "embeddings_table", sourceType: type, similarity: score },
      });
    }
    return results;
  } catch {
    return null; // أي تعذّر في pgvector ⇒ جرّب الاحتياطي
  }
}

/**
 * المسار الاحتياطي: إعادة ترتيب دلالية على `legal_articles.embedding`.
 * نأخذ مجموعة مرشّحين معجمية محدودة (بحث النواة) ثم نحسب cosine في الذاكرة —
 * فلا نحمّل كل المتجهات في كل استعلام (حدّ نقل البيانات).
 */
async function searchViaArticleEmbeddings(q: string, vec: number[], limit: number, minScore: number = MIN_SEMANTIC_SCORE, lawIds: string[] | null = null): Promise<RawResult[]> {
  const lexical = await findRelevantLegalArticles(q, { limit: FALLBACK_CANDIDATE_POOL, semantic: false, systemIds: lawIds ?? undefined }).catch(() => []);
  if (!lexical.length) return [];

  const byId = new Map(lexical.map((l) => [l.articleId, l]));
  const rows = await prisma.legalArticle
    .findMany({ where: { id: { in: lexical.map((l) => l.articleId) } }, select: { id: true, embedding: true } })
    .catch(() => [] as Array<{ id: string; embedding: unknown }>);
  if (!rows.length) return [];

  // حارس الأبعاد + cosine داخل التطبيق؛ السجلّات المخالفة تُتجاهَل ولا تُفشل العملية.
  const ranked = rankByCosine(vec, rows.map((r) => ({ id: r.id, embedding: r.embedding })), { limit: Math.min(limit, 20) });
  if (!ranked.length) return [];

  const results: RawResult[] = [];
  for (const { id, score } of ranked) {
    if (score < minScore) continue; // نفس عتبة المسار الأساسي
    const meta = byId.get(id);
    if (!meta) continue;
    results.push({
      type: "article",
      id,
      title: `${meta.systemName} — م/${meta.articleNumber}: ${meta.articleTitle}`,
      snippet: meta.snippet,
      score,
      source: "vector",
      reason: `تشابه دلالي (${(score * 100).toFixed(0)}%) — احتياطي من تضمين المادة`,
      meta: {
        matchedBy: "semantic",
        semanticSource: "legal_articles.embedding",
        sourceType: "article",
        articleId: id,
        systemName: meta.systemName,
        articleNumber: meta.articleNumber,
        similarity: score, // التشابه الخام (cosine) — مصدر الثقة الدلالية الحقيقي (الدفعة ١.٤).
      },
    });
  }
  return results;
}

export const vectorProvider: SearchProvider = {
  name: "vector",

  async isAvailable() {
    if (!semanticSearchEnabled()) return false;
    // متاح إن وُجد أيّ مصدر متجهات: جدول pgvector أو حقل المادة (الاحتياطي).
    if (await embeddingsTableHasRows()) return true;
    return articleEmbeddingsExist();
  },

  async search({ q, limit = 10, types, minScore, lawIds: rawLawIds }: SearchQuery): Promise<RawResult[]> {
    const lawIds = scopedLawIds({ lawIds: rawLawIds });
    if (!semanticSearchEnabled()) return [];
    const query = q.trim();
    if (!query) return [];
    try {
      const t0 = Date.now();
      const vec = await embedText(query);
      console.info(`[search] vector embed ms=${Date.now() - t0} ok=${Boolean(vec?.length)}`);
      if (!vec || vec.length === 0) return [];

      // 1) جدول pgvector إن كان متاحاً.
      const floor = resolveMinScore(minScore, MIN_SEMANTIC_SCORE);
      const fromTable = await searchViaEmbeddingsTable(vec, limit, types, floor, lawIds);
      if (fromTable !== null) return fromTable;

      // 2) احتياطي: تضمين المواد المخزَّن (Json) — إعادة ترتيب داخل التطبيق.
      return await searchViaArticleEmbeddings(query, vec, limit, floor, lawIds);
    } catch {
      return []; // أي تعذّر (امتداد/تضمين/شبكة) لا يكسر البحث
    }
  },
};
