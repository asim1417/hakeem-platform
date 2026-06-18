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

  const results = mergeResults(rawBatches.flat(), limit);
  return { query: query.q, mode, results, providers: providerStatuses, total: results.length };
}

/** دمج النتائج: مفتاح type:id، أعلى درجة + حافز التعدّد، جمع المصادر والأسباب. */
function mergeResults(raw: RawResult[], limit: number): MergedResult[] {
  const map = new Map<string, MergedResult>();
  for (const r of raw) {
    const key = `${r.type}:${r.id}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        type: r.type,
        id: r.id,
        title: r.title,
        snippet: r.snippet,
        confidence: r.score,
        sources: [r.source],
        reasons: [r.reason],
        meta: r.meta,
      });
    } else {
      existing.confidence = Math.max(existing.confidence, r.score);
      if (!existing.sources.includes(r.source)) existing.sources.push(r.source);
      if (!existing.reasons.includes(r.reason)) existing.reasons.push(r.reason);
      if (!existing.snippet && r.snippet) existing.snippet = r.snippet;
    }
  }
  // حافز ظهور النتيجة في أكثر من مزوّد (دليل أقوى)
  for (const m of map.values()) {
    if (m.sources.length > 1) {
      m.confidence = Math.min(1, m.confidence + 0.05 * (m.sources.length - 1));
    }
    m.confidence = Math.round(m.confidence * 1000) / 1000;
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}
