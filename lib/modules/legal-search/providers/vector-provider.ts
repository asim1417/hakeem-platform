import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { embedText, semanticSearchEnabled } from "@/lib/modules/ai/embeddings";
import { rankByCosine } from "@/lib/modules/legal-search/embedding-fallback";
import { findRelevantLegalArticles } from "@/lib/modules/legal-core/legal-retrieval";
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

/** هل جدول pgvector `embeddings` متاح وفيه متجهات؟ */
async function embeddingsTableHasRows(): Promise<boolean> {
  try {
    return (await prisma.embedding.count()) > 0;
  } catch {
    return false; // الجدول/الامتداد غير مُفعّل في قاعدة التشغيل
  }
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
    const rows = await prisma.$queryRawUnsafe<Array<{ owner_type: string; owner_id: string; score: number }>>(
      `SELECT owner_type, owner_id, (1 - (embedding <=> '${literal}'::vector)) AS score
       FROM embeddings
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> '${literal}'::vector
       LIMIT ${take}`
    );

    const results: RawResult[] = [];
    for (const row of rows) {
      const type = row.owner_type as EntityType;
      if (type !== "article" && type !== "ruling" && type !== "principle") continue;
      const score = Math.max(0, Math.min(1, Number(row.score)));
      // عتبة دنيا للتشابه الدلالي: تمنع ظهور نتائج بعيدة (٣٠٪–٤٠٪) كضجيج.
      if (score < MIN_SEMANTIC_SCORE) continue;
      const entity = await resolveEntity(type, row.owner_id);
      if (!entity.exists) continue;
      results.push({
        type: type as LegalEntityType,
        id: row.owner_id,
        title: entity.label,
        score,
        source: "vector",
        reason: `تشابه دلالي (${(score * 100).toFixed(0)}%)`,
        meta: { matchedBy: "semantic", semanticSource: "embeddings_table", sourceType: type },
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
      const vec = await embedText(query);
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
