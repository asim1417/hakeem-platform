import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { normalizeArabicEntityName } from "./core";

const NCEC_QUALIFIED_ORGS_URL = "https://violation.ncec.gov.sa/orgsdata";
const MAX_BYTES = 3_000_000;
const MAX_ROWS = 500;

export const NCEC_QUALIFIED_AGENCIES_SOURCE: DataSourceDefinition = {
  key: "ncec_qualified_environmental_agencies",
  nameAr: "الجهات المؤهلة في مجال الخدمات البيئية",
  authority: "المركز الوطني للرقابة على الالتزام البيئي",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 0.95,
  baseUrl: NCEC_QUALIFIED_ORGS_URL,
};

type HtmlGet = (url: URL, signal?: AbortSignal) => Promise<string>;

type QualifiedAgency = {
  name: string;
  service?: string;
  classification?: string;
  cities?: string;
};

async function defaultGet(url: URL, signal?: AbortSignal) {
  if (url.protocol !== "https:" || url.hostname !== "violation.ncec.gov.sa" || url.port) {
    throw new Error("Unexpected NCEC source host.");
  }
  const response = await fetch(url, {
    signal,
    redirect: "error",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`NCEC HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("NCEC response exceeded safe size limit.");
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_BYTES) throw new Error("NCEC response exceeded safe size limit.");
  return html;
}

function decode(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function looksSensitiveContact(value: string) {
  return /@|\b(?:\+?966|05)\d{7,}\b/i.test(value);
}

function parseAgencies(html: string): QualifiedAgency[] {
  const agencies: QualifiedAgency[] = [];
  const tr = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = tr.exec(html)) && agencies.length < MAX_ROWS) {
    const cells: string[] = [];
    const td = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = td.exec(row[1] ?? ""))) {
      const value = decode(cell[1] ?? "");
      if (value) cells.push(value);
    }
    if (!cells.length) continue;
    const name = cells.find((value) => /شركة|مؤسسة|مكتب|فرع/i.test(value) && !looksSensitiveContact(value));
    if (!name) continue;
    const service = cells.find((value) => /خدمات|التحاليل|الرصد|مراقبة|توريد|استشارات|دراسات|مختبر/i.test(value));
    const classification = cells.find((value) => /فئة\s*[أابجABC]/i.test(value));
    const cities = cells.find((value) => /المدن|الرياض|جدة|الدمام|مكة|المدينة|ينبع|الخبر|تبوك|جيزان|ابها|أبها/i.test(value) && value !== name);
    agencies.push({ name, service, classification, cities });
  }
  return agencies;
}

export class NcecQualifiedAgenciesConnector implements DueDiligenceConnector {
  source = NCEC_QUALIFIED_AGENCIES_SOURCE;
  constructor(private readonly get: HtmlGet = defaultGet) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const started = Date.now();
    const html = await this.get(new URL(NCEC_QUALIFIED_ORGS_URL), signal);
    const needle = normalizeArabicEntityName(query.name);
    const matches = parseAgencies(html).filter((agency) => {
      const candidate = normalizeArabicEntityName(agency.name);
      return needle.length >= 3 && (candidate.includes(needle) || needle.includes(candidate));
    });
    const fetchedAt = new Date().toISOString();
    const observations: RawObservation[] = matches.map((agency) => ({
      sourceKey: this.source.key,
      entityName: agency.name,
      category: "regulatory_license_listing",
      title: "ظهر الكيان ضمن الجهات المؤهلة للخدمات البيئية لدى NCEC",
      summary: [
        agency.service ? `الخدمة: ${agency.service}` : undefined,
        agency.classification ? `التصنيف: ${agency.classification}` : undefined,
        agency.cities ? agency.cities.slice(0, 400) : undefined,
      ].filter(Boolean).join(" | ") || undefined,
      sourceUrl: NCEC_QUALIFIED_ORGS_URL,
      fetchedAt,
      raw: { matchType: "published-name", service: agency.service, classification: agency.classification },
    }));

    return {
      source: this.source,
      observations,
      warnings: [
        "تم تجاهل البريد الإلكتروني وأرقام التواصل المنشورة؛ يحتفظ حكيم فقط ببيانات التأهيل اللازمة للعناية الواجبة.",
        observations.length
          ? "المطابقة الحالية بالاسم المنشور وتبقى للمراجعة؛ ظهور الكيان ضمن الجهات المؤهلة لا يرفع المخاطر بحد ذاته."
          : "عدم ظهور الاسم لا يعني عدم وجود ترخيص أو تأهيل بيئي آخر أو أحدث.",
      ],
      durationMs: Date.now() - started,
    };
  }
}

export const __ncecTest = { parseAgencies };
