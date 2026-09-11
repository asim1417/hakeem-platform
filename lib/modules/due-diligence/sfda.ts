import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";

const SFDA_DIRECTORY_PAGE = "https://sfda.gov.sa/en/node/17597";
const MAX_PAGE_BYTES = 1_000_000;
const MAX_API_BYTES = 2_000_000;
const MAX_ROWS = 100;

export const SFDA_LICENSED_ESTABLISHMENTS_SOURCE: DataSourceDefinition = {
  key: "sfda_licensed_establishments",
  nameAr: "قائمة المنشآت المرخصة",
  authority: "الهيئة العامة للغذاء والدواء",
  accessType: "OFFICIAL_API",
  status: "APPROVED",
  reliability: 1,
  baseUrl: SFDA_DIRECTORY_PAGE,
};

type JsonRecord = Record<string, unknown>;
type HttpGet = (url: URL, signal?: AbortSignal) => Promise<{ body: string; contentType: string | null }>;

function assertAllowedUrl(url: URL, kind: "page" | "api") {
  if (url.protocol !== "https:") throw new Error("SFDA connector requires HTTPS.");
  if (kind === "page") {
    if (url.hostname !== "sfda.gov.sa" || url.port) throw new Error("Unexpected SFDA directory host.");
    return;
  }
  if (url.hostname !== "api.sfda.gov.sa" || (url.port && url.port !== "9001")) {
    throw new Error("Unexpected SFDA API host.");
  }
}

async function defaultGet(url: URL, signal?: AbortSignal) {
  const kind = url.hostname === "api.sfda.gov.sa" ? "api" : "page";
  assertAllowedUrl(url, kind);
  const response = await fetch(url, {
    signal,
    redirect: "error",
    headers: {
      accept: kind === "api" ? "application/json,text/plain;q=0.8" : "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`SFDA HTTP ${response.status}`);
  const limit = kind === "api" ? MAX_API_BYTES : MAX_PAGE_BYTES;
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > limit) throw new Error("SFDA response exceeded safe size limit.");
  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > limit) throw new Error("SFDA response exceeded safe size limit.");
  return { body, contentType: response.headers.get("content-type") };
}

function discoverApiUrl(html: string): URL {
  const match = html.match(/https:\/\/api\.sfda\.gov\.sa:9001\/v1\/LicensedEstablishments\/Search\?apikey=[A-Za-z0-9_-]+/i);
  if (!match) throw new Error("تعذر اكتشاف رابط Web Service المنشور في صفحة هيئة الغذاء والدواء.");
  const url = new URL(match[0].replace(/&amp;/g, "&"));
  assertAllowedUrl(url, "api");
  return url;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function first(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function collectRecords(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 4 || value == null) return [];
  if (Array.isArray(value)) {
    const objects = value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (objects.length) return objects.slice(0, MAX_ROWS);
    return value.flatMap((item) => collectRecords(item, depth + 1)).slice(0, MAX_ROWS);
  }
  if (typeof value === "object") {
    const object = value as JsonRecord;
    const common = ["data", "items", "results", "result", "records", "value"];
    for (const key of common) {
      if (key in object) {
        const found = collectRecords(object[key], depth + 1);
        if (found.length) return found.slice(0, MAX_ROWS);
      }
    }
    for (const child of Object.values(object)) {
      const found = collectRecords(child, depth + 1);
      if (found.length) return found.slice(0, MAX_ROWS);
    }
  }
  return [];
}

function rowToObservation(row: JsonRecord, fetchedAt: string): RawObservation | null {
  const entityName = first(row, ["companyNameAR", "companyNameAr", "companyNameEN", "companyNameEn", "companyName", "name"]);
  if (!entityName) return null;
  const crNumber = first(row, ["crNumber", "commercialRegistration", "commercialRegistrationNumber", "CRNumber"]);
  const licenseNumber = first(row, ["licenseNumber", "licenceNumber", "licenseNo", "id"]);
  const licenseType = first(row, ["licenseType", "licenceType"]);
  const sector = first(row, ["typeSector", "sectorType", "sector"]);
  const city = first(row, ["city_AR", "cityAR", "city_EN", "cityEN", "city"]);
  const expiry = first(row, ["expiryDate", "expirationDate", "licenseExpiryDate"]);
  const pieces = [
    sector ? `القطاع: ${sector}` : undefined,
    licenseType ? `نوع الترخيص: ${licenseType}` : undefined,
    licenseNumber ? `رقم الترخيص: ${licenseNumber}` : undefined,
    expiry ? `الانتهاء: ${expiry}` : undefined,
  ].filter(Boolean);
  return {
    sourceKey: SFDA_LICENSED_ESTABLISHMENTS_SOURCE.key,
    sourceRecordId: licenseNumber,
    entityName,
    commercialRegistration: crNumber,
    city,
    category: "regulatory_license_listing",
    title: "منشأة مدرجة في قائمة المنشآت المرخصة لدى هيئة الغذاء والدواء",
    summary: pieces.join(" | ") || undefined,
    sourceUrl: SFDA_DIRECTORY_PAGE,
    fetchedAt,
    raw: {
      companyNameAR: first(row, ["companyNameAR", "companyNameAr"]),
      companyNameEN: first(row, ["companyNameEN", "companyNameEn"]),
      crNumber,
      licenseType,
      sector,
      licenseNumber,
      city,
      expiry,
    },
  };
}

export class SfdaLicensedEstablishmentsConnector implements DueDiligenceConnector {
  source = SFDA_LICENSED_ESTABLISHMENTS_SOURCE;
  constructor(private readonly get: HttpGet = defaultGet) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const started = Date.now();
    const page = await this.get(new URL(SFDA_DIRECTORY_PAGE), signal);
    const apiUrl = discoverApiUrl(page.body);
    apiUrl.searchParams.set("companyNameAR", query.name);
    const api = await this.get(apiUrl, signal);
    if (api.contentType && !/json|text\/plain/i.test(api.contentType)) {
      throw new Error(`Unexpected SFDA API content-type: ${api.contentType}`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(api.body);
    } catch {
      throw new Error("SFDA Web Service returned non-JSON content.");
    }
    const fetchedAt = new Date().toISOString();
    const observations = collectRecords(parsed)
      .map((row) => rowToObservation(row, fetchedAt))
      .filter((item): item is RawObservation => Boolean(item))
      .slice(0, MAX_ROWS);

    const warnings: string[] = [
      "النتيجة الإيجابية تثبت فقط أن سجلًا مطابقًا ظهر في قائمة المنشآت المرخصة المنشورة لدى هيئة الغذاء والدواء؛ وتبقى دلالة نوع الترخيص ونطاقه خاضعة للمراجعة.",
    ];
    if (!observations.length) {
      warnings.push("لم تُعد Web Service سجلات قابلة للمطابقة. لا تُفسر النتيجة كنفي للترخيص أو كنفي لخضوع الكيان للهيئة.");
    }
    if (query.commercialRegistration && observations.some((item) => !item.commercialRegistration)) {
      warnings.push("بعض سجلات المصدر لم تتضمن رقم سجل تجاري قابلًا للاستخراج؛ لم يتم استعارة رقم السجل المدخل من المستخدم.");
    }

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - started,
    };
  }
}

export const __sfdaTest = { discoverApiUrl, collectRecords, rowToObservation };
