import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";

const SFDA_LIST_URL = "https://sfda.gov.sa/en/licensed-establishments-list";
const MAX_PAGE_BYTES = 2_000_000;
const MAX_ROWS = 100;

export const SFDA_LICENSED_ESTABLISHMENTS_SOURCE: DataSourceDefinition = {
  key: "sfda_licensed_establishments",
  nameAr: "قائمة المنشآت المرخصة",
  authority: "الهيئة العامة للغذاء والدواء",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 1,
  baseUrl: SFDA_LIST_URL,
};

type HtmlGet = (url: URL, signal?: AbortSignal) => Promise<string>;

function assertAllowedUrl(url: URL) {
  if (url.protocol !== "https:" || url.hostname !== "sfda.gov.sa" || url.port) {
    throw new Error("Unexpected SFDA licensed-establishments host.");
  }
}

async function defaultGet(url: URL, signal?: AbortSignal) {
  assertAllowedUrl(url);
  const response = await fetch(url, {
    signal,
    redirect: "error",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`SFDA HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_PAGE_BYTES) throw new Error("SFDA response exceeded safe size limit.");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_PAGE_BYTES) throw new Error("SFDA response exceeded safe size limit.");
  return body;
}

function decodeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLicensedRows(html: string) {
  const rows: Array<{
    companyName: string;
    crNumber: string;
    licenseType?: string;
    sectorType?: string;
    licenseNumber?: string;
  }> = [];
  const trPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = trPattern.exec(html)) && rows.length < MAX_ROWS) {
    const cells: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellPattern.exec(rowMatch[1] ?? ""))) {
      const text = decodeHtml(cellMatch[1] ?? "");
      if (text) cells.push(text);
    }
    if (cells.length < 2) continue;
    const crIndex = cells.findIndex((cell) => /^\d{10}$/.test(cell.replace(/\D/g, "")));
    if (crIndex < 1) continue;
    const crNumber = cells[crIndex]!.replace(/\D/g, "");
    rows.push({
      companyName: cells[crIndex - 1]!,
      crNumber,
      licenseType: cells[crIndex + 1],
      sectorType: cells[crIndex + 2],
      licenseNumber: cells[crIndex + 3],
    });
  }
  return rows;
}

function rowToObservation(
  row: ReturnType<typeof extractLicensedRows>[number],
  sourceUrl: string,
  fetchedAt: string
): RawObservation {
  const pieces = [
    row.sectorType ? `القطاع: ${row.sectorType}` : undefined,
    row.licenseType ? `نوع الترخيص: ${row.licenseType}` : undefined,
    row.licenseNumber ? `رقم الترخيص: ${row.licenseNumber}` : undefined,
  ].filter(Boolean);
  return {
    sourceKey: SFDA_LICENSED_ESTABLISHMENTS_SOURCE.key,
    sourceRecordId: row.licenseNumber,
    entityName: row.companyName,
    commercialRegistration: row.crNumber,
    category: "regulatory_license_listing",
    title: "منشأة مدرجة في قائمة المنشآت المرخصة لدى هيئة الغذاء والدواء",
    summary: pieces.join(" | ") || undefined,
    sourceUrl,
    fetchedAt,
    raw: { ...row },
  };
}

export class SfdaLicensedEstablishmentsConnector implements DueDiligenceConnector {
  source = SFDA_LICENSED_ESTABLISHMENTS_SOURCE;
  constructor(private readonly get: HtmlGet = defaultGet) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const started = Date.now();
    const url = new URL(SFDA_LIST_URL);
    if (query.commercialRegistration) url.searchParams.set("crNumber", query.commercialRegistration.replace(/\D/g, ""));
    else url.searchParams.set("companyNameAR", query.name);
    const html = await this.get(url, signal);
    const fetchedAt = new Date().toISOString();
    const rows = extractLicensedRows(html);
    const observations = rows.map((row) => rowToObservation(row, url.toString(), fetchedAt));

    const warnings: string[] = [
      "النتيجة الإيجابية تثبت فقط أن سجلًا ظهر في قائمة المنشآت المرخصة المنشورة لدى هيئة الغذاء والدواء؛ وتبقى دلالة نوع الترخيص ونطاقه خاضعة للمراجعة.",
    ];
    if (!observations.length) {
      warnings.push("لم تظهر سجلات قابلة للاستخراج في نتيجة البحث العامة. لا تُفسر النتيجة كنفي للترخيص أو كنفي لخضوع الكيان للهيئة.");
    }

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - started,
    };
  }
}

export const __sfdaTest = { decodeHtml, extractLicensedRows, rowToObservation };
