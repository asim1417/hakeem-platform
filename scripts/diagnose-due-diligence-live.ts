import { htmlToSearchText, CMA_INSTITUTIONS_URL } from "../lib/modules/due-diligence/cma";
import { SAMA_FINANCE_ENTITIES_URL } from "../lib/modules/due-diligence/sama";

async function inspect(url: string, needle: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "user-agent": "HakeemDueDiligenceAudit/1.0 (+https://hakeemai.net)",
    },
  });
  const text = await response.text();
  const searchable = htmlToSearchText(text);
  const index = searchable.indexOf(needle);
  console.log(JSON.stringify({
    requestedUrl: url,
    finalUrl: response.url,
    status: response.status,
    contentType: response.headers.get("content-type"),
    contentLengthHeader: response.headers.get("content-length"),
    bodyLength: text.length,
    searchableLength: searchable.length,
    needle,
    needleIndex: index,
    snippet: index >= 0 ? searchable.slice(Math.max(0, index - 250), index + needle.length + 500) : searchable.slice(0, 700),
  }, null, 2));
}

async function main() {
  console.log("=== CMA diagnostics ===");
  await inspect(CMA_INSTITUTIONS_URL, "شركة وزان النمو");
  console.log("=== SAMA diagnostics ===");
  await inspect(SAMA_FINANCE_ENTITIES_URL, "7001455307");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
