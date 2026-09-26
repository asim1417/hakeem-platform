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
import { searchRulingsDirect, rulingHitToMerged, type RulingHit } from "./rulings-search";

// إعادة تصدير لتحويل نتائج الأحكام إلى الشكل الموحّد في بقية المسارات.
export { rulingHitToMerged } from "./rulings-search";

/** سقوف تمثيل كل نوع في النتيجة الموحّدة — تضمن ظهور الأحكام/المبادئ في تبويباتها. */
const ARTICLE_CAP = 25;
const RULING_CAP = 15;
const PRINCIPLE_CAP = 10;

// عمق حساب الأوجه (facets) — أوسع من سقف العرض كي تعكس الأعداد المجموعةَ الكاملة للمطابقات
// لا صفحةَ العرض فقط (إصلاح الأوجه المبتورة، الدفعة ١.٥).
const FACET_FETCH = 200;

// عمق **تجسيد** مواد النواة (جلب النصّ + بناء المقتطف) — صغير لأن العرض مسقوف بـ ARTICLE_CAP.
// الأوجه تُحسب داخل النواة على العمق الكامل (خفيفة، بلا تجسيد)، فلا حاجة لتجسيد ٢٠٠ صفًّا
// كي نعرض ٢٥ — تحسين سرعة لا يمسّ الترتيب ولا أعداد الأوجه (تحسين الأداء، بلا تغيّر نتائج).
const ARTICLE_MATERIALIZE = 50;

export type FacetValue = { value: string; count: number };
export interface ComprehensiveFacets {
  system: FacetValue[];
  classification: FacetValue[];
  status: FacetValue[];
  court: FacetValue[];
  year: FacetValue[];
}
/** استجابة النواة الشاملة = الشكل الهجين + أوجه محسوبة خادميًا على المجموعة الأوسع. */
export type ComprehensiveResponse = HybridSearchResponse & { facets: ComprehensiveFacets };

const EMPTY_FACETS: ComprehensiveFacets = { system: [], classification: [], status: [], court: [], year: [] };

/** عدّاد قيَم مرتّب تنازليًا (يتجاهل الفارغ). */
function countBy<T>(rows: T[], get: (r: T) => string | null | undefined): FacetValue[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = (get(r) ?? "").toString().trim();
    if (v) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

function metaField(r: MergedResult, key: string): string | undefined {
  const v = r.meta?.[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : undefined;
}

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

/** ثابت RRF القياسي (Cormack et al. 2009) — نفس القيمة المستعملة في الدمج الهجين. */
const RRF_K = 60;

/**
 * دمج متعدّد الأنواع بـ Reciprocal Rank Fusion على **الرتبة داخل النوع**.
 * كل نوع محفوظ ترتيبه الداخلي (من محرّكه المُوالَف)؛ نعطيه درجة موحّدة قابلة للمقارنة
 * = 1/(K + رتبته داخل نوعه). فيتشابك أعلى كل نوع بإنصاف بلا مقارنة درجات غير متجانسة.
 * التعادل يُكسَر بأولوية النوع (المواد أولاً) ثم بالثقة الأصلية — فالترتيب حتميّ ومستقرّ.
 */
function interleaveByRRF(groups: Array<{ items: MergedResult[]; priority: number }>): MergedResult[] {
  const scored = groups.flatMap(({ items, priority }) =>
    items.map((item, rank) => ({ item, priority, unified: 1 / (RRF_K + rank + 1) }))
  );
  scored.sort((a, b) => b.unified - a.unified || b.priority - a.priority || b.item.confidence - a.item.confidence);
  return scored.map((s) => s.item);
}

/** يطبّع درجات النواة (غير محدودة) إلى ثقة عرض [0..1] نسبةً لأعلى نتيجة في المجموعة. */
function normalizeArticleConfidence(results: LegalCoreResult[]): Map<string, number> {
  const max = results.reduce((m, r) => Math.max(m, r.relevanceScore), 0) || 1;
  const out = new Map<string, number>();
  for (const r of results) out.set(r.articleId, Math.round((r.relevanceScore / max) * 1000) / 1000);
  return out;
}

/**
 * البحث الشامل عبر النواة: مواد (searchLegalCore) + أحكام مفهرسة (searchRulingsDirect)
 * + مبادئ من الهجين. يعيد شكل HybridSearchResponse نفسه.
 */
export async function searchLegalCoreComprehensive(q: string, limit = 30): Promise<ComprehensiveResponse> {
  const query = (q ?? "").trim();
  if (!query) {
    return { query: "", mode: "legal-core-comprehensive", results: [], providers: [], total: 0, facets: EMPTY_FACETS };
  }

  // المواد من النواة؛ الأحكام من الفهرس المباشر (search_norm)؛ المبادئ/احتياط الأحكام من الهجين.
  const rulingFetch = Math.max(RULING_CAP, Math.min(FACET_FETCH, 60));
  const [core, hybrid, directRulings] = await Promise.all([
    searchLegalCore({
      query,
      limit: Math.max(limit, ARTICLE_MATERIALIZE),
      includeSnippets: true,
      semantic: true,
      includeFacets: true,
      facetDepth: FACET_FETCH,
    }).catch(() => null),
    hybridSearch({ q: query, limit: Math.max(limit, FACET_FETCH) }).catch(() => null),
    searchRulingsDirect({ query, limit: rulingFetch }).catch(() => ({ hits: [] as RulingHit[], total: 0, ms: 0 })),
  ]);

  const coreResults = core?.results ?? [];
  const confMap = normalizeArticleConfidence(coreResults);
  const coreArticleIds = new Set(coreResults.map((a) => a.articleId));
  let articles: MergedResult[] = coreResults
    .slice(0, ARTICLE_CAP)
    .map((a) => articleToMerged(a, confMap.get(a.articleId) ?? 0));

  const hybridResults = hybrid?.results ?? [];
  const exact = hybridResults.find((r) => r.type === "article" && r.meta?.exactMatch === true);
  if (exact && !coreArticleIds.has(exact.id)) {
    articles = [{ ...exact, confidence: 1 }, ...articles].slice(0, ARTICLE_CAP);
  }

  // أحكام: الفهرس المباشر أولًا (أدق على 51 ألف حكم)، ثم إكمال من الهجين دون تكرار.
  const rulingById = new Map<string, MergedResult>();
  for (const h of directRulings.hits) rulingById.set(h.id, rulingHitToMerged(h));
  for (const r of hybridResults.filter((x) => x.type === "ruling")) {
    if (!rulingById.has(r.id)) rulingById.set(r.id, r);
  }
  const allRulings = [...rulingById.values()];
  const rulings = allRulings.slice(0, RULING_CAP);
  const principles = hybridResults.filter((r) => r.type === "principle").slice(0, PRINCIPLE_CAP);

  const results = interleaveByRRF([
    { items: articles, priority: 3 },
    { items: rulings, priority: 2 },
    { items: principles, priority: 1 },
  ]);

  const cf = core?.facetCounts;
  const facets: ComprehensiveFacets = {
    system: cf?.system ?? countBy(coreResults, (a) => a.systemName),
    classification: cf?.classification ?? countBy(coreResults, (a) => a.classification),
    status: cf?.status ?? countBy(coreResults, (a) => a.status),
    court: countBy(allRulings, (r) => metaField(r, "court")),
    year: countBy(allRulings, (r) => metaField(r, "year")).sort((a, b) => Number(b.value) - Number(a.value)),
  };

  const providers = hybrid?.providers ?? [];
  return {
    query,
    mode: "legal-core-comprehensive",
    results,
    facets,
    providers,
    total: results.length,
  };
}
