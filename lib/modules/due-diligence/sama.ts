import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { normalizeArabicEntityName } from "./core";
import { htmlToSearchText } from "./cma";

/**
 * Server-rendered official list of finance companies. Unlike the newer dynamic
 * page, the company names are present in the HTTP response and can therefore be
 * verified reliably by Hakim's server runtime when SAMA's public web tier is reachable.
 */
export const SAMA_FINANCE_ENTITIES_URL =
  "https://www.sama.gov.sa/en-US/Supervision/LicenseEntities/Pages/MultiActivitiesLicensedEntities.aspx";

const SAMA_FINANCE_ENTITIES_FALLBACK_URL =
  "https://sama.gov.sa/en-US/Supervision/LicenseEntities/Pages/MultiActivitiesLicensedEntities.aspx";

export const SAMA_FINANCE_ENTITIES_SOURCE: DataSourceDefinition = {
  key: "sama_finance_entities",
  nameAr: "شركات التمويل المرخصة",
  authority: "البنك المركزي السعودي",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 1,
  baseUrl: "https://www.sama.gov.sa",
};

type TextFetcher = (url: string, signal?: AbortSignal) => Promise<string>;

function isOfficialSamaHost(hostname: string): boolean {
  return hostname === "sama.gov.sa" || hostname === "www.sama.gov.sa";
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function fetchOfficialSamaPageOnce(url: string, signal?: AbortSignal): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !isOfficialSamaHost(parsed.hostname) || parsed.port) {
    throw new Error("SAMA connector refused a non-official host.");
  }
  const response = await fetch(parsed, {
    method: "GET",
    signal,
    cache: "no-store",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) {
    const error = new Error(`SAMA licensed-entities page returned HTTP ${response.status}`);
    (error as Error & { retryable?: boolean }).retryable = isRetryableStatus(response.status);
    throw error;
  }

  const finalUrl = new URL(response.url || parsed.toString());
  if (finalUrl.protocol !== "https:" || !isOfficialSamaHost(finalUrl.hostname)) {
    throw new Error("SAMA connector refused an off-domain redirect.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error("SAMA licensed-entities page returned an unexpected content type.");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > 5_000_000) throw new Error("SAMA licensed-entities response is unexpectedly large.");
  const html = await response.text();
  if (html.length > 5_000_000) throw new Error("SAMA licensed-entities response exceeded the safe size limit.");
  return html;
}

async function fetchOfficialSamaPage(_url: string, signal?: AbortSignal): Promise<string> {
  const candidates = [
    SAMA_FINANCE_ENTITIES_URL,
    SAMA_FINANCE_ENTITIES_URL,
    SAMA_FINANCE_ENTITIES_FALLBACK_URL,
  ];
  let lastError: unknown;

  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    if (signal?.aborted) throw signal.reason ?? new Error("SAMA request aborted.");
    try {
      return await fetchOfficialSamaPageOnce(candidates[attempt]!, signal);
    } catch (error) {
      lastError = error;
      const retryable =
        !(error instanceof Error) ||
        (error as Error & { retryable?: boolean }).retryable !== false;
      if (!retryable || attempt === candidates.length - 1) break;
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 250 : 750));
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError ?? "unknown error");
  throw new Error(`تعذر الوصول إلى القائمة العامة للبنك المركزي بعد محاولات آمنة على النطاق الرسمي فقط: ${detail}`);
}

/**
 * Positive-only discovery against SAMA's public finance-company directory.
 *
 * The stable public page currently exposes company names but not a reliably
 * machine-readable unified number in the server response. We therefore NEVER
 * manufacture an identifier match from the user's query: positive hits remain
 * NEEDS_REVIEW until a stronger identifier is confirmed from another source.
 */
export class SamaFinanceEntitiesConnector implements DueDiligenceConnector {
  public readonly source = SAMA_FINANCE_ENTITIES_SOURCE;

  constructor(private readonly fetchText: TextFetcher = fetchOfficialSamaPage) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const html = await this.fetchText(SAMA_FINANCE_ENTITIES_URL, signal);
    const pageText = htmlToSearchText(html);
    const normalizedPage = normalizeArabicEntityName(pageText);
    const normalizedName = normalizeArabicEntityName(query.name);
    const found = normalizedName.length >= 3 && normalizedPage.includes(normalizedName);
    const fetchedAt = new Date().toISOString();

    const observations: RawObservation[] = found
      ? [
          {
            sourceKey: this.source.key,
            sourceRecordId: `name:${normalizedName}`,
            entityName: query.name,
            category: "regulatory_license_listing",
            title: "ظهر اسم الكيان في القائمة الرسمية لشركات التمويل المرخصة",
            summary:
              "مطابقة اسم إيجابية في قائمة البنك المركزي السعودي العامة. لا تُنسب للنتيجة مطابقة رقم موحد أو سجل تجاري ما لم ينشره مصدر رسمي قابل للتحقق؛ يلزم التحقق من هوية الكيان ونطاق الترخيص قبل الاعتماد النهائي.",
            sourceUrl: SAMA_FINANCE_ENTITIES_URL,
            fetchedAt,
            raw: {
              matchType: "normalized_name_in_server_rendered_public_list",
              officialPage: SAMA_FINANCE_ENTITIES_URL,
            },
          },
        ]
      : [];

    const warnings = found
      ? [
          "ظهر اسم الكيان في قائمة شركات التمويل المرخصة المنشورة لدى البنك المركزي. النتيجة مطابقة اسم فقط وتبقى للمراجعة ولا ترفع المخاطر.",
          ...(query.unifiedNumber
            ? ["أُدخل رقم موحد في البحث، لكن هذه الصفحة العامة لا تعرضه بصورة قابلة للتحقق في استجابة الخادم؛ لم يُستخدم الرقم لرفع الثقة."]
            : []),
        ]
      : [
          "لم يظهر الاسم في قائمة شركات التمويل التي أمكن فحصها. لا تُفسر النتيجة كنفي للترخيص أو كمخالفة؛ قد يكون الكيان خارج هذه الفئة أو مدرجًا في قائمة تنظيمية أخرى لدى البنك المركزي.",
        ];

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}
