import { z } from "zod";
import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";
import { ministryCommerceGetJson } from "./mc-tls";
import { SAUDI_BANKRUPTCY_SOURCE, SaudiBankruptcyConnector } from "./bankruptcy";

/**
 * Contract expected from a trusted source adapter.
 * Government/public sources differ widely (API, open data, public search).
 * We normalize them outside the orchestration core so the core never receives
 * an arbitrary URL from the end user and cannot become an SSRF/open-proxy surface.
 */
const normalizedRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    entityName: z.string().trim().min(1).max(240),
    unifiedNumber: z.string().trim().max(64).optional(),
    commercialRegistration: z.string().trim().max(64).optional(),
    city: z.string().trim().max(160).optional(),
    category: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(500),
    summary: z.string().trim().max(5_000).optional(),
    sourceUrl: z.string().url().max(2_000),
    occurredAt: z.string().max(100).optional(),
    raw: z.unknown().optional(),
  })
  .strict();

const normalizedSourcePayloadSchema = z
  .object({
    records: z.array(normalizedRecordSchema).max(250).optional(),
    warnings: z.array(z.string().max(1_000)).max(50).optional(),
  })
  .strict();

type NormalizedSourcePayload = z.infer<typeof normalizedSourcePayloadSchema>;
type ConnectorEnvironment = Record<string, string | undefined>;

type SharePointCollection = {
  value?: unknown[];
  d?: { results?: unknown[] };
};

type MinistryJsonGet = (url: URL, signal?: AbortSignal) => Promise<SharePointCollection>;

/** Current endpoint is taken from the live GISInfo page JavaScript. */
export const MC_GIS_ENDPOINT =
  "https://mc.gov.sa/ar/About/Statistics/_api/web/lists/GetByTitle('GISInfo')/items";
export const MC_GIS_DOC_URL = "https://mc.gov.sa/ar/About/Statistics/Pages/GISInfo.aspx";

const MAX_ADAPTER_RESPONSE_BYTES = 2 * 1024 * 1024;

function assertHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Due diligence connector endpoints must use HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in connector URLs.");
  return url;
}

function odataString(value: string): string {
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error("Invalid control character in OData filter.");
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Official Ministry of Commerce open-data connector.
 *
 * IMPORTANT: GISInfo contains aggregate commercial-registry context such as
 * CityName, BusinessType and CRsCount. It is NOT proof that a named entity owns
 * or holds a particular CR. Consequently this connector deliberately returns
 * zero entity observations and cannot change an entity's risk score.
 */
export class SaudiCommerceGisConnector implements DueDiligenceConnector {
  public readonly source: DataSourceDefinition = {
    key: "saudi_commerce_gis",
    nameAr: "بيانات السجلات التجارية الجغرافية المفتوحة",
    authority: "وزارة التجارة",
    accessType: "OPEN_DATA",
    status: "APPROVED",
    reliability: 1,
    baseUrl: "https://mc.gov.sa",
  };

  constructor(private readonly getJson: MinistryJsonGet = ministryCommerceGetJson) {}

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const city = query.city?.trim();
    if (!city) {
      return {
        source: this.source,
        observations: [],
        warnings: [
          "مصدر وزارة التجارة للبيانات الجغرافية متصل، لكن يلزم تحديد المدينة لاسترجاع السياق التجاري المجمع.",
        ],
        durationMs: Date.now() - startedAt,
      };
    }

    const endpoint = assertHttpsUrl(MC_GIS_ENDPOINT);
    endpoint.searchParams.set("$filter", `(CityName eq ${odataString(city)})`);
    endpoint.searchParams.set("$top", "200");

    const payload = await this.getJson(endpoint, signal);
    const rows = Array.isArray(payload.value)
      ? payload.value
      : Array.isArray(payload.d?.results)
        ? payload.d.results
        : [];

    const warnings = rows.length
      ? [
          `اتصال وزارة التجارة ناجح: أُعيد ${rows.length} صف/صفوف GISInfo مجمعة للمدينة «${city}». هذه بيانات سياقية ولا تثبت تسجيل الكيان محل الفحص.`,
          `مرجع المصدر الرسمي: ${MC_GIS_DOC_URL}`,
        ]
      : [
          `اتصال وزارة التجارة ناجح، ولم يُعد GISInfo صفوفًا للمدينة «${city}». لا تُفسَّر هذه النتيجة على أنها نفي لوجود سجل تجاري للكيان.`,
          `مرجع المصدر الرسمي: ${MC_GIS_DOC_URL}`,
        ];

    return {
      source: this.source,
      observations: [],
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}

/**
 * Server-configured normalized adapter with a strict trust boundary.
 *
 * Besides HTTPS and server-only configuration, the adapter payload is schema
 * validated, bounded in size/count and restricted to source-specific categories.
 * This prevents a malformed or compromised adapter from inventing an unexpected
 * adverse category that would silently alter Hakim's risk score.
 */
export class NormalizedJsonConnector implements DueDiligenceConnector {
  private readonly allowedCategories: ReadonlySet<string>;

  constructor(
    public readonly source: DataSourceDefinition,
    private readonly endpoint: string,
    private readonly bearerToken: string | undefined,
    allowedCategories: readonly string[]
  ) {
    assertHttpsUrl(endpoint);
    if (!allowedCategories.length) throw new Error(`${source.key}: allowedCategories cannot be empty.`);
    this.allowedCategories = new Set(allowedCategories);
  }

  async collect(query: EntityQuery, signal?: AbortSignal): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const endpoint = assertHttpsUrl(this.endpoint);
    const response = await fetch(endpoint, {
      method: "POST",
      signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...(this.bearerToken ? { authorization: `Bearer ${this.bearerToken}` } : {}),
      },
      body: JSON.stringify({
        name: query.name,
        unifiedNumber: query.unifiedNumber,
        commercialRegistration: query.commercialRegistration,
        city: query.city,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`${this.source.key}: source adapter returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/application\/json|\+json/i.test(contentType)) {
      throw new Error(`${this.source.key}: source adapter returned a non-JSON content type.`);
    }
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_ADAPTER_RESPONSE_BYTES) {
      throw new Error(`${this.source.key}: source adapter response exceeded the size limit.`);
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > MAX_ADAPTER_RESPONSE_BYTES) {
      throw new Error(`${this.source.key}: source adapter response exceeded the size limit.`);
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${this.source.key}: source adapter returned invalid JSON.`);
    }
    const parsed = normalizedSourcePayloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(`${this.source.key}: source adapter payload failed schema validation.`);
    }

    const payload: NormalizedSourcePayload = parsed.data;
    const fetchedAt = new Date().toISOString();
    const warnings = [...(payload.warnings ?? [])];
    const observations: RawObservation[] = [];

    for (const record of payload.records ?? []) {
      if (!this.allowedCategories.has(record.category)) {
        warnings.push(
          `استُبعد سجل من ${this.source.nameAr} لأن الفئة «${record.category}» غير مسموحة لهذا التكامل.`
        );
        continue;
      }

      let evidenceUrl: URL;
      try {
        evidenceUrl = assertHttpsUrl(record.sourceUrl);
      } catch {
        warnings.push(`استُبعد سجل من ${this.source.nameAr} لأن رابط الإثبات غير صالح أو غير آمن.`);
        continue;
      }

      observations.push({
        sourceKey: this.source.key,
        sourceRecordId: record.id === undefined ? undefined : String(record.id),
        entityName: record.entityName,
        unifiedNumber: record.unifiedNumber,
        commercialRegistration: record.commercialRegistration,
        city: record.city,
        category: record.category,
        title: record.title,
        summary: record.summary,
        sourceUrl: evidenceUrl.toString(),
        occurredAt: record.occurredAt,
        fetchedAt,
        raw: record.raw ?? record,
      });
    }

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}

export class StaticDueDiligenceConnector implements DueDiligenceConnector {
  constructor(
    public readonly source: DataSourceDefinition,
    private readonly observations: RawObservation[]
  ) {}

  async collect(): Promise<SourceRunResult> {
    return { source: this.source, observations: this.observations, warnings: [], durationMs: 0 };
  }
}

const SOURCE_CATALOG: Array<{
  envKey: string;
  tokenEnvKey?: string;
  allowedCategories: readonly string[];
  source: DataSourceDefinition;
}> = [
  {
    envKey: "DUE_DILIGENCE_COMMERCE_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_COMMERCE_ADAPTER_TOKEN",
    allowedCategories: ["corporate_identity", "registration", "business_activity", "address"],
    source: {
      key: "saudi_commerce",
      nameAr: "بيانات المنشأة التجارية — مستوى الكيان",
      authority: "وزارة التجارة / المصدر التجاري المعتمد",
      accessType: "AUTHORIZED",
      status: "APPROVED",
      reliability: 1,
    },
  },
  {
    envKey: "DUE_DILIGENCE_IP_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_IP_ADAPTER_TOKEN",
    allowedCategories: ["trademark", "ip_asset"],
    source: {
      key: "saudi_ip",
      nameAr: "الملكية الفكرية والعلامات",
      authority: "الهيئة السعودية للملكية الفكرية / محرك البحث المعتمد",
      accessType: "AUTHORIZED",
      status: "APPROVED",
      reliability: 1,
      baseUrl: "https://www.saip.gov.sa",
    },
  },
  {
    envKey: "DUE_DILIGENCE_REGULATORY_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_REGULATORY_ADAPTER_TOKEN",
    allowedCategories: ["regulatory_license_listing", "regulatory_action", "license_issue"],
    source: {
      key: "saudi_regulatory",
      nameAr: "التراخيص والقرارات التنظيمية",
      authority: "الجهة التنظيمية المختصة / المصدر المعتمد",
      accessType: "AUTHORIZED",
      status: "APPROVED",
      reliability: 1,
    },
  },
];

/** Only server-side environment configuration can enable entity-level adapters. */
export function buildConfiguredConnectors(
  env: ConnectorEnvironment = process.env
): DueDiligenceConnector[] {
  const connectors: DueDiligenceConnector[] = [new SaudiCommerceGisConnector()];

  const bankruptcyEndpoint = env.DUE_DILIGENCE_BANKRUPTCY_ADAPTER_URL?.trim();
  if (bankruptcyEndpoint) {
    connectors.push(
      new SaudiBankruptcyConnector(
        bankruptcyEndpoint,
        env.DUE_DILIGENCE_BANKRUPTCY_ADAPTER_TOKEN?.trim()
      )
    );
  }

  for (const entry of SOURCE_CATALOG) {
    const endpoint = env[entry.envKey]?.trim();
    if (!endpoint) continue;
    const source = { ...entry.source, baseUrl: assertHttpsUrl(endpoint).origin };
    connectors.push(
      new NormalizedJsonConnector(
        source,
        endpoint,
        entry.tokenEnvKey ? env[entry.tokenEnvKey]?.trim() : undefined,
        entry.allowedCategories
      )
    );
  }
  return connectors;
}

export function dueDiligenceSourceCatalog(): DataSourceDefinition[] {
  return [
    new SaudiCommerceGisConnector().source,
    SAUDI_BANKRUPTCY_SOURCE,
    ...SOURCE_CATALOG.map((entry) => ({ ...entry.source })),
  ];
}
