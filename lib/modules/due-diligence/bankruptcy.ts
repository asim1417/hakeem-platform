import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";

export type BankruptcyPublicRecord = {
  id?: string;
  debtorName: string;
  commercialRegistration?: string;
  documentSource?: string;
  documentDate?: string;
  summary?: string;
  title?: string;
  procedureType?: string;
  sourceUrl: string;
  raw?: unknown;
};

export type BankruptcyAdapterPayload = {
  records?: BankruptcyPublicRecord[];
  warnings?: string[];
  checkedAt?: string;
};

export type BankruptcyAdapterTransport = (
  endpoint: URL,
  body: {
    name: string;
    commercialRegistration?: string;
    unifiedNumber?: string;
  },
  signal?: AbortSignal,
  bearerToken?: string
) => Promise<BankruptcyAdapterPayload>;

export const SAUDI_BANKRUPTCY_REGISTER_URL =
  "https://bankruptcy.gov.sa/ar/Other/BankruptcyRecord";
export const SAUDI_BANKRUPTCY_ANNOUNCEMENTS_URL =
  "https://bankruptcy.gov.sa/ar/Announcements";

export const SAUDI_BANKRUPTCY_SOURCE: DataSourceDefinition = {
  key: "saudi_bankruptcy",
  nameAr: "سجل وإعلانات الإفلاس",
  authority: "لجنة الإفلاس — إيسار",
  accessType: "AUTHORIZED",
  status: "APPROVED",
  reliability: 1,
  baseUrl: "https://bankruptcy.gov.sa",
};

function assertHttpsEndpoint(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Bankruptcy adapter endpoint must use HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in adapter URLs.");
  return url;
}

function isOfficialBankruptcyEvidenceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname !== "bankruptcy.gov.sa" && url.hostname !== "www.bankruptcy.gov.sa") {
      return false;
    }
    const path = url.pathname.toLowerCase();
    return (
      path.includes("/other/bankruptcyrecord") ||
      path.includes("/announcements/") ||
      path === "/ar/announcements"
    );
  } catch {
    return false;
  }
}

function normalizeIdentifier(value?: string): string | undefined {
  const normalized = value?.replace(/\D/g, "");
  return normalized || undefined;
}

export const defaultBankruptcyAdapterTransport: BankruptcyAdapterTransport = async (
  endpoint,
  body,
  signal,
  bearerToken
) => {
  const response = await fetch(endpoint, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`saudi_bankruptcy: authorized adapter returned HTTP ${response.status}`);
  }
  return (await response.json()) as BankruptcyAdapterPayload;
};

/**
 * Saudi Bankruptcy Commission connector.
 *
 * The Bankruptcy Commission register is a public official source, but the
 * Commission may require proof of identity for access and no public API is
 * assumed here. Hakeem therefore talks only to a server-configured authorized
 * adapter/egress path. The adapter must return links to the official Commission
 * register/announcement pages; non-official evidence URLs are rejected.
 */
export class SaudiBankruptcyConnector implements DueDiligenceConnector {
  public readonly source = SAUDI_BANKRUPTCY_SOURCE;
  private readonly endpoint: URL;

  constructor(
    endpoint: string,
    private readonly bearerToken?: string,
    private readonly transport: BankruptcyAdapterTransport = defaultBankruptcyAdapterTransport
  ) {
    this.endpoint = assertHttpsEndpoint(endpoint);
  }

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const payload = await this.transport(
      this.endpoint,
      {
        name: query.name,
        commercialRegistration: normalizeIdentifier(query.commercialRegistration),
        unifiedNumber: normalizeIdentifier(query.unifiedNumber),
      },
      signal,
      this.bearerToken
    );

    const fetchedAt = payload.checkedAt ?? new Date().toISOString();
    const warnings = [...(payload.warnings ?? [])];
    const observations: RawObservation[] = [];

    for (const record of payload.records ?? []) {
      if (!record.debtorName?.trim()) {
        warnings.push("استُبعدت نتيجة من موصل الإفلاس لعدم وجود اسم مدين.");
        continue;
      }
      if (!isOfficialBankruptcyEvidenceUrl(record.sourceUrl)) {
        warnings.push("استُبعدت نتيجة من موصل الإفلاس لأن رابط الإثبات لا يعود إلى سجل/إعلانات لجنة الإفلاس الرسمي.");
        continue;
      }

      const cr = normalizeIdentifier(record.commercialRegistration);
      observations.push({
        sourceKey: this.source.key,
        sourceRecordId: record.id,
        entityName: record.debtorName.trim(),
        commercialRegistration: cr,
        category: "bankruptcy",
        title: record.title?.trim() || record.procedureType?.trim() || "واقعة منشورة في سجل/إعلانات الإفلاس",
        summary: record.summary?.trim() || record.documentSource?.trim(),
        sourceUrl: record.sourceUrl,
        occurredAt: record.documentDate,
        fetchedAt,
        raw: record.raw ?? record,
      });
    }

    if (!observations.length) {
      warnings.push(
        "عدم ورود نتيجة من موصل الإفلاس لا يُعد إفادة رسمية بخلو السجل، ولا ينفي وجود واقعة ما لم يصدر المصدر الرسمي إفادة بذلك."
      );
    }

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}
