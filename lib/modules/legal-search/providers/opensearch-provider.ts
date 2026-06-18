import {
  getOpenSearchConfig,
  openSearchHeaders,
  type LegalEntityType,
  type RawResult,
  type SearchProvider,
  type SearchQuery,
} from "./search-provider";

// مزوّد OpenSearch/Elasticsearch — مستقل وقابل للتبديل. اختياري بالكامل:
// إن لم تُضبط متغيرات البيئة أو تعذّر الاتصال، يُعَدّ غير متاح ولا يكسر البحث.
export const opensearchProvider: SearchProvider = {
  name: "opensearch",

  async isAvailable() {
    const cfg = getOpenSearchConfig();
    if (!cfg) return false;
    try {
      const res = await fetch(`${cfg.url}/_cluster/health`, {
        headers: openSearchHeaders(cfg),
        signal: AbortSignal.timeout(2500),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async search({ q, limit = 10 }: SearchQuery): Promise<RawResult[]> {
    const cfg = getOpenSearchConfig();
    if (!cfg) return [];
    try {
      const body = {
        size: Math.min(limit, 20),
        query: {
          multi_match: {
            query: q,
            fields: ["title^2", "content", "judgmentTitle^2", "judgmentText", "principleText", "lawName"],
            type: "best_fields",
          },
        },
      };
      const res = await fetch(`${cfg.url}/${cfg.indexArticles},${cfg.indexCases}/_search`, {
        method: "POST",
        headers: openSearchHeaders(cfg),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        hits?: { max_score?: number; hits?: Array<{ _score?: number; _source?: Record<string, unknown> }> };
      };
      const hits = data.hits?.hits ?? [];
      const maxScore = data.hits?.max_score || 1;

      const results: RawResult[] = [];
      for (const h of hits) {
        const src = h._source ?? {};
        const type = String(src.type ?? "") as LegalEntityType;
        if (type !== "article" && type !== "ruling" && type !== "principle") continue;
        const id = String(src.id ?? "");
        if (!id) continue;
        const score = Math.max(0, Math.min(1, (h._score ?? 0) / maxScore));
        results.push({
          type,
          id,
          title: String(src.title ?? src.judgmentTitle ?? id),
          snippet: typeof src.content === "string" ? src.content.slice(0, 200) : undefined,
          score,
          source: "opensearch",
          reason: "تطابق نصّي متقدّم (OpenSearch)",
        });
      }
      return results;
    } catch {
      return [];
    }
  },
};
