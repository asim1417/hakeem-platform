import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { normalizeArabicEntityName } from "./core";

export const CMA_INSTITUTIONS_URL =
  "https://cma.org.sa/Market/AuthorisedPersons/Pages/default.aspx";

export const CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE: DataSourceDefinition = {
  key: "cma_capital_market_institutions",
  nameAr: "مؤسسات السوق المالية المرخصة",
  authority: "هيئة السوق المالية",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 1,
  baseUrl: "https://cma.org.sa",
};

type TextFetcher = (url: string, signal?: AbortSignal) => Promise<string>;

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

async function fetchOfficialCmaPage(url: string, signal?: AbortSignal): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "cma.org.sa") {
    throw new Error("CMA connector refused a non-official host.");
  }
  const response = await fetch(parsed, {
    method: "GET",
    signal,
    cache: "no-store",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`CMA public list returned HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("CMA public list returned an unexpected content type.");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > 4_000_000) throw new Error("CMA public list response is unexpectedly large.");
  const html = await response.text();
  if (html.length > 4_000_000) throw new Error("CMA public list response exceeded the safe size limit.");
  return html;
}

/**
 * Positive-match connector for the official public list of Capital Market Institutions.
 *
 * It never treats "not found" as proof that an entity is unlicensed: most Saudi entities
 * are outside CMA's licensing perimeter, and the public page may paginate/transform data.
 */
export class CmaCapitalMarketInstitutionsConnector implements DueDiligenceConnector {
  public readonly source = CMA_CAPITAL_MARKET_INSTITUTIONS_SOURCE;

  constructor(private readonly fetchText: TextFetcher = fetchOfficialCmaPage) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const html = await this.fetchText(CMA_INSTITUTIONS_URL, signal);
    const pageText = htmlToSearchText(html);
    const normalizedPage = normalizeArabicEntityName(pageText);
    const normalizedName = normalizeArabicEntityName(query.name);
    const found = normalizedName.length >= 3 && normalizedPage.includes(normalizedName);

    const observations: RawObservation[] = found
      ? [
          {
            sourceKey: this.source.key,
            sourceRecordId: `name:${normalizedName}`,
            entityName: query.name,
            city: query.city,
            category: "regulatory_license_listing",
            title: "ظهر اسم الكيان في القائمة الرسمية لمؤسسات السوق المالية",
            summary:
              "مطابقة اسم إيجابية في القائمة العامة المنشورة لهيئة السوق المالية. يلزم تأكيد هوية الكيان ونطاق النشاط المرخص قبل الاعتماد النهائي، خصوصًا عند تشابه الأسماء.",
            sourceUrl: CMA_INSTITUTIONS_URL,
            fetchedAt: new Date().toISOString(),
            raw: {
              matchType: "normalized_exact_name_in_public_list",
              officialPage: CMA_INSTITUTIONS_URL,
            },
          },
        ]
      : [];

    const warnings = found
      ? [
          "الاسم ظهر في القائمة الرسمية لهيئة السوق المالية؛ تُعامل النتيجة كإشارة ترخيص إيجابية تحتاج مطابقة الهوية ونطاق النشاط.",
        ]
      : [
          "لم يظهر الاسم في المحتوى العام الذي أمكن فحصه من قائمة هيئة السوق المالية. لا تُفسر النتيجة كنفي للترخيص أو كمخالفة؛ قد يكون الكيان خارج نطاق الهيئة أو يتطلب بحثًا أعمق في القائمة.",
        ];

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}
