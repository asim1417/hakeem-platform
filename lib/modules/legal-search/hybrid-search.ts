import { prisma } from "@/lib/prisma";
import { parseArticleQuery } from "./query-parse";
import { loadSystemsRegistry, matchSystemsInText, normalizeSystemName, type SystemRef } from "@/lib/modules/agents/substrate/systems-registry";
import { EMPTY_SURFACE, inSurface, loadSearchSurface, mapToSurface } from "@/lib/modules/legal-core/search-surface";
import { knowledgeGraphProvider } from "./providers/knowledge-graph-provider";
import { opensearchProvider } from "./providers/opensearch-provider";
import { postgresProvider } from "./providers/postgres-provider";
import { vectorProvider } from "./providers/vector-provider";
import {
  getSearchMode,
  type LegalEntityType,
  type ProviderStatus,
  type RawResult,
  type SearchProvider,
  type SearchQuery,
  type SearchSource,
} from "./providers/search-provider";

const ALL_PROVIDERS: SearchProvider[] = [
  postgresProvider,
  vectorProvider,
  knowledgeGraphProvider,
  opensearchProvider,
];

export interface MergedResult {
  type: LegalEntityType;
  id: string;
  title: string;
  snippet?: string;
  confidence: number; // 0..1
  sources: SearchSource[]; // المزوّدات التي أرجعت النتيجة
  reasons: string[]; // أسباب المطابقة
  meta?: Record<string, unknown>;
}

export interface HybridSearchResponse {
  query: string;
  mode: string;
  results: MergedResult[];
  providers: { name: SearchSource; status: ProviderStatus }[];
  total: number;
}

// إعادة تصدير المُحلّل المشترك (لتوافق المستوردين الحاليين مثل الاختبارات).
export { parseArticleQuery } from "./query-parse";

/**
 * مطابقة مباشرة لنمط «المادة {رقم} {اسم النظام}»: يستعلم مقيّدًا بالنظام المطابق —
 * فلا تُعاد مادة بالرقم الصحيح من نظام خاطئ. يعيد null إن لم ينطبق النمط.
 * الموجة ١: الاسم بالمساواة بعد التطبيع أو بأطول جوهر كامل (لا «contains» ولا ترتيب بالعدّاد)،
 * ثم التحويل إلى وجه العمل في asOf: «المادة 1 من نظام التنفيذ» = م/53 حتى 2026-10-27، وم/237 من 2026-10-28.
 */
export async function findExactArticleMatch(q: string, opts: { asOf?: string; surface?: "current" | "archive" } = {}): Promise<MergedResult | null> {
  const parsed = parseArticleQuery(q);
  if (!parsed) return null;
  const { articleNumber: n, systemHint: hint } = parsed;

  const registry = await loadSystemsRegistry().catch(() => [] as SystemRef[]);
  const core = normalizeSystemName(hint);
  const exact = registry.filter((r) => normalizeSystemName(r.name) === core);
  const refs = exact.length ? exact : matchSystemsInText(hint, registry);
  if (!refs.length) return null;

  const { surface } = opts.surface === "archive" ? { surface: EMPTY_SURFACE } : await loadSearchSurface(opts.asOf);
  const ids = mapToSurface(refs.map((r) => r.id), surface);
  if (!ids.length) return null;

  // عند تعدّد الأنظمة بعد الوجه (نادر): الأطول جوهرًا أولًا كما رتّبها المطابِق.
  for (const id of ids) {
    const article = await prisma.legalArticle
      .findFirst({ where: { legalSystemId: id, articleNumber: n }, select: { id: true, lawName: true, articleNumber: true, title: true, legalSystemId: true } })
      .catch(() => null);
    if (!article) continue;
    return {
      type: "article",
      id: article.id,
      title: `${article.lawName} — م/${article.articleNumber}: ${article.title}`,
      confidence: 1,
      sources: ["postgres"],
      reasons: ["مطابقة مباشرة: رقم المادة ضمن النظام المذكور في الاستعلام (النسخة السارية)"],
      meta: { articleId: article.id, systemName: article.lawName, systemId: article.legalSystemId, articleNumber: article.articleNumber, sourceType: "article", exactMatch: true, surfaceAsOf: surface.asOf },
    };
  }
  return null;
}

/** يُسقط المواد التي أنظمتها خارج الوجه (استعلام واحد على المعرّفات المعروضة). */
async function filterArticlesToSurface(results: MergedResult[], opts: { asOf?: string; surface?: "current" | "archive" }): Promise<MergedResult[]> {
  if (opts.surface === "archive") return results;
  const { surface, hiddenNames } = await loadSearchSurface(opts.asOf);
  if (!surface.hidden.size) return results;
  const articleIds = results.filter((r) => r.type === "article").map((r) => r.id);
  if (!articleIds.length) return results;
  const rows = await prisma.legalArticle
    .findMany({ where: { id: { in: articleIds } }, select: { id: true, legalSystemId: true, lawName: true } })
    .catch(() => [] as Array<{ id: string; legalSystemId: string | null; lawName: string }>);
  const out = new Set(rows.filter((r) => !inSurface(r, surface, hiddenNames)).map((r) => r.id));
  return out.size ? results.filter((r) => !(r.type === "article" && out.has(r.id))) : results;
}

/** منسّق البحث الهجين: يشغّل المزوّدات المتاحة، يدمج ويزيل التكرار ويرتّب. */
export async function hybridSearch(query: SearchQuery): Promise<HybridSearchResponse> {
  const mode = getSearchMode();
  const selected = mode === "hybrid" ? ALL_PROVIDERS : ALL_PROVIDERS.filter((p) => p.name === mode);
  const limit = Math.min(query.limit ?? 10, 30);

  const providerStatuses: { name: SearchSource; status: ProviderStatus }[] = [];
  const rawBatches = await Promise.all(
    selected.map(async (p): Promise<RawResult[]> => {
      try {
        const available = await p.isAvailable();
        if (!available) {
          providerStatuses.push({ name: p.name, status: "unavailable" });
          return [];
        }
        const r = await p.search({ ...query, limit });
        providerStatuses.push({ name: p.name, status: "active" });
        return r;
      } catch {
        providerStatuses.push({ name: p.name, status: "unavailable" });
        return [];
      }
    })
  );

  let results = mergeResultsRRF(rawBatches, limit);

  // مطابقة «المادة {رقم} {نظام}» المباشرة تتصدّر النتائج (تصحيح تجاهل اسم النظام كقيد).
  const exact = await findExactArticleMatch(query.q, { asOf: query.asOf, surface: query.surface }).catch(() => null);
  if (exact) {
    results = [exact, ...results.filter((r) => !(r.type === "article" && r.id === exact.id))].slice(0, limit);
  }
  // وجه البحث: مواد الأنظمة المخفية اليوم لا تظهر في صناديق البحث (الأحكام والمبادئ كما هي).
  results = await filterArticlesToSurface(results, { asOf: query.asOf, surface: query.surface }).catch(() => results);

  return { query: query.q, mode, results, providers: providerStatuses, total: results.length };
}

/** نوع المطابقة المُجمَّع من المصادر المساهِمة. */
export type MatchedBy = "lexical" | "semantic" | "hybrid";

/** يشتقّ نوع المطابقة من المزوّدات التي أرجعت النتيجة. */
export function deriveMatchedBy(sources: SearchSource[]): MatchedBy {
  const hasSemantic = sources.includes("vector");
  const hasLexical = sources.some((s) => s === "postgres" || s === "opensearch" || s === "knowledge_graph");
  if (hasSemantic && hasLexical) return "hybrid";
  if (hasSemantic) return "semantic";
  return "lexical";
}

/** مفتاح استشهاد مقروء يربط النتيجة بمرجعها الرسمي. */
function buildCitationKey(m: MergedResult, meta: Record<string, unknown>): string {
  if (m.type === "article") {
    const system = typeof meta.systemName === "string" ? meta.systemName : null;
    const number = meta.articleNumber;
    if (system && number !== undefined && number !== null) return `${system} — المادة (${number})`;
  }
  return m.title;
}

/** ثابت RRF القياسي (Cormack et al. 2009): يخفّف أثر الرتب المتأخّرة ويوازن المزوّدات. */
const RRF_K = 60;

/**
 * دمج بـ Reciprocal Rank Fusion — المعيار العالمي لدمج نتائج مزوّدات غير متجانسة الدرجات.
 * بدل جمع/أخذ أعلى درجة خام (غير قابلة للمقارنة بين معجمي 0.55–0.95 ودلالي cosine)، نعتمد
 * **الرتبة داخل كل مزوّد**: مساهمة كل مزوّد = 1/(K + rank). فلا يلزم تطبيع، واتفاق مزوّدَين
 * على نتيجة يرفعها تلقائياً (مجموع مساهمتين) — دليل أقوى بلا أوزان يدوية هشّة.
 */
function mergeResultsRRF(batches: RawResult[][], limit: number): MergedResult[] {
  type Fused = MergedResult & { rrf: number; rawMax: number };
  const map = new Map<string, Fused>();
  for (const batch of batches) {
    // كل مزوّد يُرتَّب بدرجته الخاصة، ثم نأخذ الرتبة (لا الدرجة) للدمج.
    const ranked = [...batch].sort((a, b) => b.score - a.score);
    ranked.forEach((r, i) => {
      const key = `${r.type}:${r.id}`;
      const contrib = 1 / (RRF_K + i + 1);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          type: r.type,
          id: r.id,
          title: r.title,
          snippet: r.snippet,
          confidence: 0,
          sources: [r.source],
          reasons: [r.reason],
          meta: { ...(r.meta ?? {}) },
          rrf: contrib,
          rawMax: r.score,
        });
      } else {
        existing.rrf += contrib; // اتفاق المزوّدات يرفع الدرجة (جوهر RRF)
        existing.rawMax = Math.max(existing.rawMax, r.score);
        if (!existing.sources.includes(r.source)) existing.sources.push(r.source);
        if (!existing.reasons.includes(r.reason)) existing.reasons.push(r.reason);
        if (!existing.snippet && r.snippet) existing.snippet = r.snippet;
        existing.meta = { ...(r.meta ?? {}), ...(existing.meta ?? {}) };
      }
    });
  }
  const arr = [...map.values()];
  const maxRrf = arr.reduce((m, x) => Math.max(m, x.rrf), 1e-9);
  for (const m of arr) {
    // ثقة العرض 0..1: درجة RRF نسبةً لأعلى نتيجة (شفّافة للمستخدم).
    m.confidence = Math.round((m.rrf / maxRrf) * 1000) / 1000;
    const base = m.meta ?? {};
    m.meta = {
      ...base,
      sourceType: m.type,
      articleId: m.type === "article" ? m.id : base.articleId,
      systemName: base.systemName,
      articleNumber: base.articleNumber,
      citationKey: buildCitationKey(m, base),
      score: m.confidence,
      rrf: Math.round(m.rrf * 1e6) / 1e6,
      matchedBy: deriveMatchedBy(m.sources),
    };
  }
  return arr.sort((a, b) => b.rrf - a.rrf).slice(0, limit);
}
