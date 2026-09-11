import type { DataSourceDefinition } from "./core";

/** Legacy public directory page. Kept as a human-verification link only. */
export const CMA_INSTITUTIONS_URL =
  "https://cma.gov.sa/Market/AuthorisedPersons/Pages/default.aspx";

/** Official CMA Open Data API documented in the Authority's Swagger portal. */
export const CMA_OPEN_DATA_API_URL =
  "https://opendataapi.cma.gov.sa/api/Licenses/GetAllOrganizations";

/**
 * CMA is an official public source, but live audit from Hakim's current cloud
 * egress showed that the legacy directory can return a maintenance page and
 * the Open Data API can time out. Until a stable approved egress/adapter is
 * provisioned, the catalog must NOT present this source as an active connector.
 */
export const CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE: DataSourceDefinition = {
  key: "cma_capital_market_institutions",
  nameAr: "مؤسسات السوق المالية المرخصة",
  authority: "هيئة السوق المالية",
  accessType: "OFFICIAL_API",
  status: "REVIEW_REQUIRED",
  reliability: 1,
  baseUrl: "https://opendataapi.cma.gov.sa",
};

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    zwnj: "",
    zwj: "",
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return Number.isFinite(point) ? String.fromCodePoint(point) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : " ";
    })
    .replace(/&([a-z]+);/gi, (full, name: string) => named[name.toLowerCase()] ?? full);
}

/** Shared inert HTML-to-text helper used by public-web connectors. */
export function htmlToSearchText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--([\s\S]*?)-->/g, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}
