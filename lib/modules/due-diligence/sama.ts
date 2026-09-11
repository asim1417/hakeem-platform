import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { normalizeArabicEntityName } from "./core";
import { htmlToSearchText } from "./cma";

export const SAMA_FINANCE_ENTITIES_URL =
  "https://sama.gov.sa/ar-sa/Supervision/LicenseEntities/Pages/FinanceLicencedEntities.aspx";

export const SAMA_FINANCE_ENTITIES_SOURCE: DataSourceDefinition = {
  key: "sama_finance_entities",
  nameAr: "شركات التمويل المرخصة",
  authority: "البنك المركزي السعودي",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 1,
  baseUrl: "https://sama.gov.sa",
};

type TextFetcher = (url: string, signal?: AbortSignal) => Promise<string>;

async function fetchOfficialSamaPage(url: string, signal?: AbortSignal): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname !== "sama.gov.sa") {
    throw new Error("SAMA connector refused a non-official host.");
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
  if (!response.ok) throw new Error(`SAMA licensed-entities page returned HTTP ${response.status}`);
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

function takeWindow(text: string, center: number, before = 450, after = 850): string {
  return text.slice(Math.max(0, center - before), Math.min(text.length, center + after));
}

function extractField(windowText: string, label: string, stopLabels: string[]): string | undefined {
  const start = windowText.indexOf(label);
  if (start < 0) return undefined;
  const remainder = windowText.slice(start + label.length).trim();
  let end = remainder.length;
  for (const stop of stopLabels) {
    const index = remainder.indexOf(stop);
    if (index >= 0 && index < end) end = index;
  }
  const value = remainder.slice(0, end).replace(/\s+/g, " ").trim();
  return value ? value.slice(0, 220) : undefined;
}

function entityNameNearUnifiedNumber(pageText: string, unifiedNumber: string): string | undefined {
  const index = pageText.indexOf(unifiedNumber);
  if (index < 0) return undefined;
  const windowText = takeWindow(pageText, index);
  return extractField(windowText, "اسم الشركة", [
    "شركات التمويل",
    "شركات النشاطات المساندة للتمويل",
    "نوع النشاط",
    "الرقم الموحد",
    "رقم الترخيص",
    "قم بزيارة موقع الشركة",
  ]);
}

function licenseNearUnifiedNumber(pageText: string, unifiedNumber: string): string | undefined {
  const index = pageText.indexOf(unifiedNumber);
  if (index < 0) return undefined;
  const windowText = takeWindow(pageText, index, 120, 500);
  return extractField(windowText, "رقم الترخيص", ["قم بزيارة موقع الشركة", "اسم الشركة", "شركات التمويل"]);
}

/**
 * Positive-only verification against SAMA's public finance-company list.
 * Exact unified-number matches are much stronger than name-only matches.
 * A miss is never converted to an adverse finding or a claim of no licence.
 */
export class SamaFinanceEntitiesConnector implements DueDiligenceConnector {
  public readonly source = SAMA_FINANCE_ENTITIES_SOURCE;

  constructor(private readonly fetchText: TextFetcher = fetchOfficialSamaPage) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const html = await this.fetchText(SAMA_FINANCE_ENTITIES_URL, signal);
    const pageText = htmlToSearchText(html);
    const fetchedAt = new Date().toISOString();
    const observations: RawObservation[] = [];
    const warnings: string[] = [];

    if (query.unifiedNumber) {
      const unified = query.unifiedNumber.replace(/\D/g, "");
      const index = unified ? pageText.indexOf(unified) : -1;
      if (index >= 0) {
        const extractedName = entityNameNearUnifiedNumber(pageText, unified);
        const licence = licenseNearUnifiedNumber(pageText, unified);
        const sourceName = extractedName ?? query.name;
        const queryName = normalizeArabicEntityName(query.name);
        const sourceNameNormalized = normalizeArabicEntityName(sourceName);

        // If the page structure did not expose the name, we keep the user's name only as a label,
        // but the exact official unified-number hit remains explicitly documented in matchReasons.
        observations.push({
          sourceKey: this.source.key,
          sourceRecordId: `unified:${unified}`,
          entityName: sourceName,
          unifiedNumber: unified,
          category: "regulatory_license_listing",
          title: licence
            ? `ترخيص تمويل منشور لدى البنك المركزي — ${licence}`
            : "ظهر الرقم الموحد في قائمة شركات التمويل المرخصة",
          summary:
            extractedName && queryName !== sourceNameNormalized
              ? `الاسم المنشور قرب الرقم الموحد: ${extractedName}. يجب مراجعة اختلاف الاسم قبل الاعتماد النهائي.`
              : "مطابقة إيجابية للرقم الموحد في القائمة الرسمية العامة لشركات التمويل المرخصة لدى البنك المركزي السعودي.",
          sourceUrl: SAMA_FINANCE_ENTITIES_URL,
          fetchedAt,
          raw: {
            matchType: "exact_unified_number_in_public_list",
            extractedName: extractedName ?? null,
            licenceNumber: licence ?? null,
          },
        });
        if (!extractedName) {
          warnings.push("تم العثور على الرقم الموحد، لكن تعذر استخراج اسم الشركة من بنية الصفحة؛ راجع المصدر الرسمي قبل الاعتماد النهائي.");
        }
      } else {
        warnings.push(
          "لم يظهر الرقم الموحد في صفحة شركات التمويل التي أمكن فحصها. لا تُفسر النتيجة كنفي للترخيص أو كمخالفة؛ قد يكون نشاط الكيان خارج فئة شركات التمويل أو في قائمة تنظيمية أخرى."
        );
      }
    } else {
      const normalizedPage = normalizeArabicEntityName(pageText);
      const normalizedName = normalizeArabicEntityName(query.name);
      if (normalizedName.length >= 3 && normalizedPage.includes(normalizedName)) {
        observations.push({
          sourceKey: this.source.key,
          sourceRecordId: `name:${normalizedName}`,
          entityName: query.name,
          category: "regulatory_license_listing",
          title: "ظهر اسم الكيان في قائمة شركات التمويل لدى البنك المركزي",
          summary: "مطابقة اسم إيجابية فقط؛ يلزم الرقم الموحد أو مراجعة بشرية لرفع الثقة في هوية الكيان.",
          sourceUrl: SAMA_FINANCE_ENTITIES_URL,
          fetchedAt,
          raw: { matchType: "normalized_name_in_public_list" },
        });
      } else {
        warnings.push(
          "لم يظهر الاسم في صفحة شركات التمويل التي أمكن فحصها. لا تُفسر النتيجة كنفي للترخيص؛ يُفضّل إدخال الرقم الموحد والتحقق من القوائم الأخرى للبنك المركزي حسب النشاط."
        );
      }
    }

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}
