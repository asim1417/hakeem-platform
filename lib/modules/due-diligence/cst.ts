import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { normalizeArabicEntityName } from "./core";

const CST_IOT_URL = "https://www.cst.gov.sa/en/knowledge-center/digital-knowledge/IOT/IoT-Landscape/IoT-Service-Providers";
const MAX_BYTES = 1_500_000;

export const CST_IOT_ENTITIES_SOURCE: DataSourceDefinition = {
  key: "cst_iot_entities",
  nameAr: "مقدمو خدمات إنترنت الأشياء",
  authority: "هيئة الاتصالات والفضاء والتقنية",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 0.9,
  baseUrl: CST_IOT_URL,
};

type HtmlGet = (url: URL, signal?: AbortSignal) => Promise<string>;

async function defaultGet(url: URL, signal?: AbortSignal) {
  if (url.protocol !== "https:" || url.hostname !== "www.cst.gov.sa" || url.port) {
    throw new Error("Unexpected CST source host.");
  }
  const response = await fetch(url, {
    signal,
    redirect: "error",
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": "HakeemDueDiligence/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`CST HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("CST response exceeded safe size limit.");
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_BYTES) throw new Error("CST response exceeded safe size limit.");
  return html;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export class CstIotEntitiesConnector implements DueDiligenceConnector {
  source = CST_IOT_ENTITIES_SOURCE;
  constructor(private readonly get: HtmlGet = defaultGet) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const started = Date.now();
    const html = await this.get(new URL(CST_IOT_URL), signal);
    const text = htmlToText(html);
    const haystack = normalizeArabicEntityName(text);
    const needle = normalizeArabicEntityName(query.name);
    const found = needle.length >= 3 && haystack.includes(needle);
    const observations: RawObservation[] = found
      ? [
          {
            sourceKey: this.source.key,
            entityName: query.name,
            category: "regulatory_license_listing",
            title: "ظهر اسم الكيان في قائمة مقدمي خدمات إنترنت الأشياء لدى هيئة الاتصالات والفضاء والتقنية",
            summary:
              "CST تصف هذه القائمة بأنها للجهات المسجلة أو المصرح لها أو المرخصة لتقديم خدمات إنترنت الأشياء. المطابقة هنا بالاسم فقط ولا تثبت رقم ترخيص أو نطاقًا تنظيميًا آخر.",
            sourceUrl: CST_IOT_URL,
            fetchedAt: new Date().toISOString(),
            raw: { matchType: "normalized-full-name", limitedScope: "IoT service providers" },
          },
        ]
      : [];

    const warnings = [
      "هذا المصدر محدود بقائمة مقدمي خدمات إنترنت الأشياء لدى CST ولا يمثل جميع التراخيص أو التصاريح الصادرة من الهيئة.",
      found
        ? "المطابقة بالاسم فقط وتبقى NEEDS_REVIEW؛ لا تستخدم لإثبات رقم ترخيص أو لرفع المخاطر."
        : "عدم ظهور الاسم لا يعني أن الكيان غير مرخص أو غير مسجل لدى CST؛ قد يكون خارج نطاق قائمة IoT أو منشورًا في سجل آخر.",
    ];

    return { source: this.source, observations, warnings, durationMs: Date.now() - started };
  }
}

export const __cstTest = { htmlToText };
