import { prisma } from "@/lib/prisma";
import { parseArticleQuery, normalizeArabicQuery } from "./query-parse";
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
 */
async function findExactArticleMatch(q: string): Promise<MergedResult | null> {
  const parsed = parseArticleQuery(q);
  if (!parsed) return null;
  const { articleNumber: n, systemHint: hint } = parsed;

  const findSystem = (needle: string) =>
    prisma.legalSystem.findFirst({ where: { name: { contains: needle, mode: "insensitive" } }, select: { id: true, name: true }, orderBy: { articleCount: "desc" } }).catch(() => null);

  let sys = await findSystem(hint);
  if (!sys) {
    const longest = hint.split(/\s+/).filter((w) => w.length >= 4).sort((a, b) => b.length - a.length)[0];
    if (longest) sys = await findSystem(longest);
  }
  if (!sys) {
    // سقوط مُطبَّع (الدفعة ١.٣): يتجاوز اختلاف الهمزة/التاء المربوطة/الألف المقصورة بين
    // اسم النظام في الاستعلام واسمه في القاعدة — بمطابقة بعد التطبيع العربي الموحّد.
    const systems = await prisma.legalSystem
      .findMany({ select: { id: true, name: true }, orderBy: { articleCount: "desc" } })
      .catch(() => [] as Array<{ id: string; name: string }>);
    const nHint = normalizeArabicQuery(hint);
    if (nHint.length >= 3) {
      sys =
        systems.find((s) => {
          const nName = normalizeArabicQuery(s.name);
          return nName.includes(nHint) || nHint.includes(nName);
        }) ?? null;
    }
  }
  if (!sys) return null;

  const article = await prisma.legalArticle
    .findFirst({ where: { OR: [{ legalSystemId: sys.id }, { lawName: sys.name }], articleNumber: n }, select: { id: true, lawName: true, articleNumber: true, title: true } })
    .catch(() => null);
  if (!article) return null;

  return {
    type: "article",
    id: article.id,
    title: `${article.lawName} — م/${article.articleNumber}: ${article.title}`,
    confidence: 1,
    sources: ["postgres"],
    reasons: ["مطابقة مباشرة: رقم المادة ضمن النظام المذكور في الاستعلام"],
    meta: { articleId: article.id, systemName: article.lawName, articleNumber: article.articleNumber, sourceType: "article", exactMatch: true },
  };
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
  const exact = await findExactArticleMatch(query.q).catch(() => null);
  if (exact) {
    results = [exact, ...results.filter((r) => !(r.type === "article" && r.id === exact.id))].slice(0, limit);
  }

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
