import { prisma } from "@/lib/prisma";
import {
  getOpenSearchConfig,
  openSearchHeaders,
} from "../legal-search/providers/search-provider";
export async function indexHealth() {
  const counts = await Promise.all([
    prisma.legalArticle.count(),
    prisma.judicialCase.count(),
    prisma.judicialPrinciple.count(),
  ]);
  const config = getOpenSearchConfig();
  return Promise.all(
    (["article", "ruling", "principle"] as const).map(async (type, i) => {
      const base = { type, database: counts[i] };
      if (!config)
        return {
          ...base,
          indexed: null,
          difference: null,
          error: "OpenSearch غير مهيأ",
        };
      try {
        const index =
          type === "article" ? config.indexArticles : config.indexCases;
        const res = await fetch(
          `${config.url}/${encodeURIComponent(index)}/_count`,
          {
            method: "POST",
            headers: openSearchHeaders(config),
            body: JSON.stringify({ query: { term: { type } } }),
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: unknown = await res.json();
        if (
          !data ||
          typeof data !== "object" ||
          !("count" in data) ||
          typeof data.count !== "number"
        )
          throw new Error("استجابة غير صالحة");
        return {
          ...base,
          indexed: data.count,
          difference: counts[i] - data.count,
          error: null,
        };
      } catch (e) {
        return {
          ...base,
          indexed: null,
          difference: null,
          error: e instanceof Error ? e.message : "تعذر الاتصال بالفهرس",
        };
      }
    }),
  );
}
