import {
  getOpenSearchConfig,
  openSearchHeaders,
  type LegalEntityType,
  type RawResult,
  type SearchProvider,
  type SearchQuery,
} from "./search-provider";
import { parseArticleQuery } from "../query-parse";

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
      // فصل «المادة {رقم} {نظام}» لجعلهما قيدَين قويَّين (يحلّ خلط الأنظمة والأرقام).
      const parsed = parseArticleQuery(q);
      const must: Record<string, unknown>[] = [];
      const should: Record<string, unknown>[] = [];
      if (parsed) {
        must.push({ term: { articleNumber: parsed.articleNumber } });
        must.push({ match: { lawName: { query: parsed.systemHint, operator: "and" } } });
      }
      if (q) {
        should.push(
          { match: { title: { query: q, boost: 3 } } },
          { match: { judgmentTitle: { query: q, boost: 3 } } },
          { match: { content: { query: q, boost: 2 } } },
          { match: { "content.exact": { query: q, boost: 4 } } },
          { match: { judgmentText: { query: q } } },
          { match: { principleText: { query: q } } },
          { match: { lawName: { query: q } } }
        );
      }

      const body = {
        size: Math.min(limit, 20),
        query: {
          bool: {
            must,
            should,
            minimum_should_match: should.length ? 1 : 0,
            // استبعاد غير المعتمد من المخرجات (term على حقل مفقود لا يستبعد الأحكام/المبادئ).
            must_not: [{ term: { status: "needs_review" } }],
          },
        },
        highlight: { fields: { content: {}, title: {}, judgmentText: {} }, pre_tags: ["<mark>"], post_tags: ["</mark>"] },
      };

      const res = await fetch(`${cfg.url}/${cfg.indexArticles},${cfg.indexCases}/_search`, {
        method: "POST",
        headers: openSearchHeaders(cfg),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        hits?: { max_score?: number; hits?: Array<{ _score?: number; _source?: Record<string, unknown>; highlight?: Record<string, string[]> }> };
      };
      const hits = data.hits?.hits ?? [];
      const maxScore = data.hits?.max_score || 1;

      const results: RawResult[] = [];
      for (const h of hits) {
        const src = h._source ?? {};
        const type = String(src.type ?? "") as LegalEntityType;
        if (type !== "article" && type !== "ruling" && type !== "principle") continue;
        const id = String(src.id ?? src.articleId ?? "");
        if (!id) continue;
        const score = Math.max(0, Math.min(1, (h._score ?? 0) / maxScore));
        const hl = h.highlight ?? {};
        const snippet = hl.content?.[0] ?? hl.judgmentText?.[0] ?? (typeof src.content === "string" ? src.content.slice(0, 200) : undefined);
        results.push({
          type,
          id,
          title: String(src.title ?? src.judgmentTitle ?? src.lawName ?? id),
          snippet,
          score,
          source: "opensearch",
          reason: "تطابق نصّي متقدّم بمحلّل عربي (OpenSearch)",
          meta: { systemName: src.lawName, articleNumber: src.articleNumber, sourceType: type },
        });
      }
      return results;
    } catch {
      return [];
    }
  },
};
