// الواجهة الموحّدة لمزوّدات البحث القانوني (Hybrid Legal Search).
// كل مزوّد مستقل وقابل للتبديل، ولا يكسر التطبيق إن لم يكن متاحاً.

export type LegalEntityType = "article" | "ruling" | "principle";
export type SearchSource = "postgres" | "vector" | "knowledge_graph" | "opensearch";
export type ProviderStatus = "active" | "unavailable";

export interface SearchQuery {
  q: string;
  limit?: number;
  context?: { caseType?: string; court?: string; stage?: string };
}

// نتيجة خام من مزوّد واحد.
export interface RawResult {
  type: LegalEntityType;
  id: string;
  title: string;
  snippet?: string;
  score: number; // 0..1
  source: SearchSource;
  reason: string; // سبب المطابقة
  meta?: Record<string, unknown>;
}

export interface SearchProvider {
  name: SearchSource;
  /** هل المزوّد متاح الآن؟ يجب ألا يرمي — يعيد false عند التعذّر. */
  isAvailable(): Promise<boolean>;
  /** البحث؛ يجب أن يلتقط أخطاءه داخلياً ويعيد [] عند الفشل. */
  search(query: SearchQuery): Promise<RawResult[]>;
}

// ── الإعدادات من البيئة ──
export type SearchMode = "hybrid" | "postgres" | "vector" | "knowledge_graph" | "opensearch";

export function getSearchMode(): SearchMode {
  const v = (process.env.SEARCH_PROVIDER_MODE || "hybrid").toLowerCase();
  const allowed: SearchMode[] = ["hybrid", "postgres", "vector", "knowledge_graph", "opensearch"];
  return (allowed as string[]).includes(v) ? (v as SearchMode) : "hybrid";
}

export interface OpenSearchConfig {
  url: string;
  username?: string;
  password?: string;
  indexArticles: string;
  indexCases: string;
}

export function getOpenSearchConfig(): OpenSearchConfig | null {
  const url = (process.env.OPENSEARCH_URL || "").trim();
  if (!url) return null;
  return {
    url: url.replace(/\/$/, ""),
    username: process.env.OPENSEARCH_USERNAME || undefined,
    password: process.env.OPENSEARCH_PASSWORD || undefined,
    indexArticles: process.env.OPENSEARCH_INDEX_LEGAL_ARTICLES || "legal_articles",
    indexCases: process.env.OPENSEARCH_INDEX_JUDICIAL_CASES || "judicial_cases",
  };
}

/** ترويسة المصادقة لـ OpenSearch (basic auth) إن وُجدت. */
export function openSearchHeaders(cfg: OpenSearchConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.username && cfg.password) {
    headers.Authorization = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");
  }
  return headers;
}
