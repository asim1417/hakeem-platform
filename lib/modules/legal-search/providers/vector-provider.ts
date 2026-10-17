import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";
import { rankByCosine } from "@/lib/modules/legal-search/embedding-fallback";
import { findRelevantLegalArticles } from "@/lib/modules/legal-core/legal-retrieval";
import { latestVectorSource } from "@/lib/modules/legal-search/vector-source";
import { nearestRulingSegments, rulingSegmentVectorsReady } from "@/lib/modules/legal-core/rulings-search";
import { resolveEntity, type EntityType } from "@/lib/modules/knowledge-graph/relations";
import type { LegalEntityType, RawResult, SearchProvider, SearchQuery } from "./search-provider";

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
     WHERE rn = 1${segReady ? ` AND NOT (owner_type = 'ruling' AND owner_id IN (SELECT ruling_id FROM ruling_segment_embeddings))` : ""}
     ORDER BY embedding <=> $1::vector
     LIMIT ${take}`;
}

/** المسار المفهرس: أعلى take لكل مصدر ثم الدمج — اتحادها يحوي أعلى take الكلّي. */
async function nearestViaPartialIndexes(literal: string, take: number, segReady: boolean): Promise<VectorRow[]> {
  const q = (sql: string) => prisma.$queryRawUnsafe<VectorRow[]>(sql, literal);
  const batches = await Promise.all([
    q(partialTypeSql("article", take)),
    q(partialTypeSql("principle", take)),
    q(rulingsSql(segReady, take)),
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
async function searchViaEmbeddingsTable(vec: number[], limit: number): Promise<RawResult[] | null> {
  if (!(await embeddingsTableHasRows())) return null;
  try {
    const literal = `[${vec.map((x) => Number(x)).join(",")}]`;
    const take = Math.min(limit, 20);
    const t0 = Date.now();
    // الأحكام: متجهات الأسباب والمنطوق (ruling_segment_embeddings) متى وُجدت، بدل متجه الحكم القديم
    // المبني من أول ٨٬٠٠٠ حرف (الديباجة غالبًا) — فيُستبعد ذاك من هذا الاستعلام.
    const segReady = await rulingSegmentVectorsReady().catch(() => false);
    const sqlFor = (from: string) =>
      `SELECT owner_type, owner_id, (1 - (embedding <=> '${literal}'::vector)) AS score
       FROM ${from}
       WHERE embedding IS NOT NULL${segReady
         ? ` AND NOT (owner_type = 'ruling' AND owner_id IN (SELECT ruling_id FROM ruling_segment_embeddings))`
         : ""}
       ORDER BY embedding <=> '${literal}'::vector
       LIMIT ${take}`;
    const partial = await partialIndexesReady();
    const [baseRows, segHits] = await Promise.all([
      partial
        ? nearestViaPartialIndexes(literal, take, segReady)
        : prisma.$queryRawUnsafe<VectorRow[]>(sqlFor(latestVectorSource())).catch(() =>
            prisma.$queryRawUnsafe<VectorRow[]>(sqlFor("embeddings")),
          ),
      segReady ? nearestRulingSegments(vec).catch(() => []) : Promise.resolve([]),
    ]);
    console.info(`[search] vector sql ms=${Date.now() - t0} path=${partial ? "partial_hnsw" : "scan"}`);
    // عتبة الأحكام من قياس متجهات الأجزاء (RULINGS_SEMANTIC_MIN، 0.42)؛ وعتبة البقية كما هي.
    const segIds = new Set(segHits.map((h) => h.id));
    const rows = [
      ...baseRows.filter((r) => !(r.owner_type === "ruling" && segIds.has(r.owner_id))),
      ...segHits.slice(0, take).map((h) => ({ owner_type: "ruling", owner_id: h.id, score: h.sim, segment: true })),
    ].sort((x, y) => Number(y.score) - Number(x.score)).slice(0, take);

    // عتبة دنيا للتشابه الدلالي: تمنع ظهور نتائج بعيدة (٣٠٪–٤٠٪) كضجيج.
    // أحكام متجهات الأجزاء صُفّيت بعتبتها المقيسة في nearestRulingSegments.
    const kept = rows.filter((row) => {
      const type = row.owner_type;
      if (type !== "article" && type !== "ruling" && type !== "principle") return false;
      return Math.max(0, Math.min(1, Number(row.score))) >= MIN_SEMANTIC_SCORE || "segment" in row;
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
async function searchViaArticleEmbeddings(q: string, vec: number[], limit: number): Promise<RawResult[]> {
  const lexical = await findRelevantLegalArticles(q, { limit: FALLBACK_CANDIDATE_POOL, semantic: false }).catch(() => []);
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
    if (score < MIN_SEMANTIC_SCORE) continue; // نفس عتبة المسار الأساسي
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

  async search({ q, limit = 10 }: SearchQuery): Promise<RawResult[]> {
    if (!semanticSearchEnabled()) return [];
    const query = q.trim();
    if (!query) return [];
    try {
      const t0 = Date.now();
      const vec = await embedText(query);
      console.info(`[search] vector embed ms=${Date.now() - t0} ok=${Boolean(vec?.length)}`);
      if (!vec || vec.length === 0) return [];

      // 1) جدول pgvector إن كان متاحاً.
      const fromTable = await searchViaEmbeddingsTable(vec, limit);
      if (fromTable !== null) return fromTable;

      // 2) احتياطي: تضمين المواد المخزَّن (Json) — إعادة ترتيب داخل التطبيق.
      return await searchViaArticleEmbeddings(query, vec, limit);
    } catch {
      return []; // أي تعذّر (امتداد/تضمين/شبكة) لا يكسر البحث
    }
  },
};
