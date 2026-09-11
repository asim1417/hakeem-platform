import { htmlToSearchText, CMA_INSTITUTIONS_URL } from "../lib/modules/due-diligence/cma";
import { SAMA_FINANCE_ENTITIES_URL } from "../lib/modules/due-diligence/sama";

const CMA_OPEN_DATA_API = "https://opendataapi.cma.gov.sa/api/Licenses/GetAllOrganizations";
const SAMA_WWW_URL = "https://www.sama.gov.sa/ar-sa/Supervision/LicenseEntities/Pages/FinanceLicencedEntities.aspx";
const SAMA_STATIC_FINANCE_URL = "https://www.sama.gov.sa/en-US/Supervision/LicenseEntities/Pages/MultiActivitiesLicensedEntities.aspx";

async function inspect(url: string, needle: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      headers: {
        accept: "application/json,text/html,application/xhtml+xml,*/*;q=0.8",
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
      snippet: index >= 0 ? searchable.slice(Math.max(0, index - 250), index + needle.length + 500) : searchable.slice(0, 900),
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      requestedUrl: url,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      cause: error instanceof Error && "cause" in error ? String((error as Error & { cause?: unknown }).cause) : undefined,
    }, null, 2));
  }
}

async function main() {
  console.log("=== CMA legacy-page diagnostics ===");
  await inspect(CMA_INSTITUTIONS_URL, "شركة وزان النمو");
  console.log("=== CMA Open Data API diagnostics ===");
  await inspect(CMA_OPEN_DATA_API, "وزان");
  console.log("=== SAMA dynamic apex-host diagnostics ===");
  await inspect(SAMA_FINANCE_ENTITIES_URL, "7001455307");
  console.log("=== SAMA dynamic www-host diagnostics ===");
  await inspect(SAMA_WWW_URL, "7001455307");
  console.log("=== SAMA static licensed-finance page diagnostics ===");
  await inspect(SAMA_STATIC_FINANCE_URL, "شركة آجل للخدمات التمويلية");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
