import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { normalizeArabicEntityName } from "./core";

const SASO_PRODUCT_CERTIFICATION_URL = "https://saso.gov.sa/en/sectors/NQS/compliance_assessment/Pages/Products_certificate.aspx";
const MAX_BYTES = 1_500_000;
const MAX_ROWS = 200;

export const SASO_CONFORMITY_BODIES_SOURCE: DataSourceDefinition = {
  key: "saso_conformity_bodies",
  nameAr: "جهات تقويم المطابقة المقبولة",
  authority: "الهيئة السعودية للمواصفات والمقاييس والجودة",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 0.95,
  baseUrl: SASO_PRODUCT_CERTIFICATION_URL,
};

type HtmlGet = (url: URL, signal?: AbortSignal) => Promise<string>;

type AcceptedBody = {
  registrationNumber?: string;
  name: string;
  region?: string;
};

async function defaultGet(url: URL, signal?: AbortSignal) {
  if (url.protocol !== "https:" || url.hostname !== "saso.gov.sa" || url.port) {
    throw new Error("Unexpected SASO source host.");
  }
  const response = await fetch(url, {
    signal,
    redirect: "error",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`SASO HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("SASO response exceeded safe size limit.");
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_BYTES) throw new Error("SASO response exceeded safe size limit.");
  return html;
}

function text(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBodies(html: string): AcceptedBody[] {
  const bodies: AcceptedBody[] = [];
  const tr = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = tr.exec(html)) && bodies.length < MAX_ROWS) {
    const cells: string[] = [];
    const td = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = td.exec(row[1] ?? ""))) {
      const value = text(cell[1] ?? "");
      if (value) cells.push(value);
    }
    if (cells.length < 3) continue;
    const regIndex = cells.findIndex((value) => /^\d{3,5}$/.test(value.replace(/\s/g, "")));
    if (regIndex < 0 || !cells[regIndex + 1]) continue;
    const name = cells[regIndex + 1]!;
    if (/name|registration|s\. ?no/i.test(name)) continue;
    bodies.push({
      registrationNumber: cells[regIndex]?.replace(/\s/g, ""),
      name,
      region: cells[regIndex + 2],
    });
  }
  return bodies;
}

export class SasoConformityBodiesConnector implements DueDiligenceConnector {
  source = SASO_CONFORMITY_BODIES_SOURCE;
  constructor(private readonly get: HtmlGet = defaultGet) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const started = Date.now();
    const html = await this.get(new URL(SASO_PRODUCT_CERTIFICATION_URL), signal);
    const needle = normalizeArabicEntityName(query.name);
    const matches = parseBodies(html).filter((body) => {
      const candidate = normalizeArabicEntityName(body.name);
      return needle.length >= 3 && (candidate.includes(needle) || needle.includes(candidate));
    });
    const fetchedAt = new Date().toISOString();
    const observations: RawObservation[] = matches.map((body) => ({
      sourceKey: this.source.key,
      sourceRecordId: body.registrationNumber,
      entityName: body.name,
      category: "regulatory_license_listing",
      title: "ظهر الكيان ضمن جهات تقويم المطابقة المقبولة لدى SASO",
      summary: [
        body.registrationNumber ? `رقم القبول/التسجيل: ${body.registrationNumber}` : undefined,
        body.region ? `النطاق الجغرافي: ${body.region}` : undefined,
      ].filter(Boolean).join(" | ") || undefined,
      sourceUrl: SASO_PRODUCT_CERTIFICATION_URL,
      fetchedAt,
      raw: { registrationNumber: body.registrationNumber, region: body.region, activity: "product-certification" },
    }));

    return {
      source: this.source,
      observations,
      warnings: [
        "هذه القائمة تخص نشاط قبول جهات تقويم المطابقة لمنح شهادات المنتجات ولا تمثل جميع تراخيص أو اعتمادات SASO.",
        observations.length
          ? "المطابقة تعتمد على الاسم المنشور وتبقى للمراجعة ما لم يتوافر معرف أقوى؛ الظهور لا يرفع المخاطر بحد ذاته."
          : "عدم ظهور الاسم لا يعني عدم وجود اعتماد أو قبول آخر لدى SASO.",
      ],
      durationMs: Date.now() - started,
    };
  }
}

export const __sasoTest = { parseBodies };
