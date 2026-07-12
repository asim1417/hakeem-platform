// ─────────────────────────────────────────────────────────────────────────────
// النواة الشاملة — محرّك بحث موحّد يعيد الأنواع الثلاثة (مواد + أحكام + مبادئ).
//
// الغاية: جعل **النواة** (searchLegalCore) هي عقل البحث الوحيد خلف كل صناديق المنصّة،
// مع الحفاظ على تغطية الأحكام والمبادئ التي توفّرها المزوّدات الهجينة. فبدل محرّكَين
// يعطيان نتائج مختلفة (جذر «الفرق بين الصناديق»)، يصبح ترتيب المواد **واحداً** في كل مكان.
//
// المعمارية:
//   • المواد  → searchLegalCore (٥ إشارات: معجمي + مفاهيم + مكنز/رسم + دلالي + OpenSearch).
//   • الأحكام/المبادئ → hybridSearch (postgres + vector + graph + opensearch عبر RRF) —
//     نأخذ منها غير-المواد فقط (تحمل court/year اللازمة للفلاتر)، ونستنقذ مطابقة
//     «المادة {رقم} {نظام}» المباشرة إن وُجدت لتتصدّر المواد.
//   • الدمج: مواد النواة (ثقة مُطبَّعة) + أحكام/مبادئ الهجين، بسقوف لكل نوع كي لا يطغى نوع.
//
// المخرجات بشكل HybridSearchResponse نفسه — فلا تتغيّر واجهة الصفحة الشاملة المستهلِكة.
// ─────────────────────────────────────────────────────────────────────────────

import { searchLegalCore, type LegalCoreResult } from "./legal-retrieval";
import { hybridSearch, type HybridSearchResponse, type MergedResult } from "@/lib/modules/legal-search/hybrid-search";
import { deriveMatchedBy } from "@/lib/modules/legal-search/hybrid-search";

/** سقوف تمثيل كل نوع في النتيجة الموحّدة — تضمن ظهور الأحكام/المبادئ في تبويباتها. */
const ARTICLE_CAP = 25;
const RULING_CAP = 15;
const PRINCIPLE_CAP = 10;

/** يحوّل نتيجة النواة (LegalCoreResult) إلى الشكل الموحّد (MergedResult) مع حفظ حقول الفلاتر. */
function articleToMerged(a: LegalCoreResult, confidence: number): MergedResult {
  const sources = a.matchType === "general" ? (["postgres"] as const) : (["postgres", "opensearch"] as const);
  return {
    type: "article",
    id: a.articleId,
    title: `${a.systemName} — م/${a.articleNumber}${a.articleTitle ? `: ${a.articleTitle}` : ""}`,
    snippet: a.snippet || undefined,
    confidence,
    sources: [...sources],
    reasons: a.relevanceReason ? [a.relevanceReason] : ["مطابقة من النواة القانونية الموحّدة"],
    meta: {
      matchedBy: deriveMatchedBy([...sources]),
      sourceType: "article",
      articleId: a.articleId,
      systemName: a.systemName,
      systemId: a.systemId ?? undefined,
      articleNumber: a.articleNumber,
      classification: a.classification ?? undefined,
      status: a.status ?? undefined,
      citationKey: a.citationLabel || `${a.systemName} — المادة (${a.articleNumber})`,
      citationCount: a.citationCount,
    },
  };
}

/** يطبّع درجات النواة (غير محدودة) إلى ثقة عرض [0..1] نسبةً لأعلى نتيجة في المجموعة. */
function normalizeArticleConfidence(results: LegalCoreResult[]): Map<string, number> {
  const max = results.reduce((m, r) => Math.max(m, r.relevanceScore), 0) || 1;
  const out = new Map<string, number>();
  for (const r of results) out.set(r.articleId, Math.round((r.relevanceScore / max) * 1000) / 1000);
  return out;
}

/**
 * البحث الشامل عبر النواة: مواد (searchLegalCore) + أحكام/مبادئ (hybridSearch).
 * يعيد شكل HybridSearchResponse نفسه ليتوافق مع الصفحة الشاملة دون تغيير في العرض.
 */
export async function searchLegalCoreComprehensive(q: string, limit = 30): Promise<HybridSearchResponse> {
  const query = (q ?? "").trim();
  if (!query) {
    return { query: "", mode: "legal-core-comprehensive", results: [], providers: [], total: 0 };
  }

  // المواد من النواة (٥ إشارات، دلالي مُفعّل)؛ والأحكام/المبادئ من الهجين (يحمل court/year + RRF).
  const [core, hybrid] = await Promise.all([
    searchLegalCore({ query, limit: Math.max(limit, ARTICLE_CAP), includeSnippets: true, semantic: true }).catch(
      () => null
    ),
    hybridSearch({ q: query, limit: Math.max(limit, RULING_CAP + PRINCIPLE_CAP) }).catch(() => null),
  ]);

  // مواد النواة → موحّدة، بثقة مُطبَّعة، بسقف التمثيل.
  const coreResults = core?.results ?? [];
  const confMap = normalizeArticleConfidence(coreResults);
  const coreArticleIds = new Set(coreResults.map((a) => a.articleId));
  let articles: MergedResult[] = coreResults
    .slice(0, ARTICLE_CAP)
    .map((a) => articleToMerged(a, confMap.get(a.articleId) ?? 0));

  // استنقاذ مطابقة «المادة {رقم} {نظام}» المباشرة من الهجين إن لم تجدها النواة — تتصدّر.
  const hybridResults = hybrid?.results ?? [];
  const exact = hybridResults.find((r) => r.type === "article" && r.meta?.exactMatch === true);
  if (exact && !coreArticleIds.has(exact.id)) {
    articles = [{ ...exact, confidence: 1 }, ...articles].slice(0, ARTICLE_CAP);
  }

  // الأحكام والمبادئ من الهجين (غير-المواد)، بسقف لكل نوع.
  const rulings = hybridResults.filter((r) => r.type === "ruling").slice(0, RULING_CAP);
  const principles = hybridResults.filter((r) => r.type === "principle").slice(0, PRINCIPLE_CAP);

  // الدمج: نرتّب كل نوع بثقته ثم نجمع (الصفحة تتولّى التبويب/الفلترة/الترتيب النهائي).
  const results = [...articles, ...rulings, ...principles].sort((a, b) => b.confidence - a.confidence);

  const providers = hybrid?.providers ?? [];
  return {
    query,
    mode: "legal-core-comprehensive",
    results,
    providers,
    total: results.length,
  };
}
