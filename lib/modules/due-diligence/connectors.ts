import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";

/**
 * Contract expected from a trusted source adapter.
 * Government/public sources differ widely (API, open data, public search).
 * We normalize them outside the orchestration core so the core never receives
 * an arbitrary URL from the end user and cannot become an SSRF/open-proxy surface.
 */
type NormalizedSourcePayload = {
  records?: Array<{
    id?: string;
    entityName: string;
    unifiedNumber?: string;
    commercialRegistration?: string;
    city?: string;
    category: string;
    title: string;
    summary?: string;
    sourceUrl: string;
    occurredAt?: string;
    raw?: unknown;
  }>;
  warnings?: string[];
};

type ConnectorEnvironment = Record<string, string | undefined>;

function assertHttpsUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Due diligence connector endpoints must use HTTPS.");
  if (url.username || url.password) throw new Error("Credentials must not be embedded in connector URLs.");
  return url;
}

export class NormalizedJsonConnector implements DueDiligenceConnector {
  constructor(
    public readonly source: DataSourceDefinition,
    private readonly endpoint: string,
    private readonly bearerToken?: string
  ) {
    assertHttpsUrl(endpoint);
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

    const payload = (await response.json()) as NormalizedSourcePayload;
    const fetchedAt = new Date().toISOString();
    const observations: RawObservation[] = (payload.records ?? []).map((record) => ({
      sourceKey: this.source.key,
      sourceRecordId: record.id,
      entityName: record.entityName,
      unifiedNumber: record.unifiedNumber,
      commercialRegistration: record.commercialRegistration,
      city: record.city,
      category: record.category,
      title: record.title,
      summary: record.summary,
      sourceUrl: record.sourceUrl,
      occurredAt: record.occurredAt,
      fetchedAt,
      raw: record.raw ?? record,
    }));

    return {
      source: this.source,
      observations,
      warnings: payload.warnings ?? [],
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
  source: DataSourceDefinition;
}> = [
  {
    envKey: "DUE_DILIGENCE_COMMERCE_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_COMMERCE_ADAPTER_TOKEN",
    source: {
      key: "saudi_commerce",
      nameAr: "بيانات المنشأة التجارية",
      authority: "وزارة التجارة / المصدر التجاري المعتمد",
      accessType: "OFFICIAL_API",
      status: "APPROVED",
      reliability: 1,
    },
  },
  {
    envKey: "DUE_DILIGENCE_BANKRUPTCY_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_BANKRUPTCY_ADAPTER_TOKEN",
    source: {
      key: "saudi_bankruptcy",
      nameAr: "سجل وإعلانات الإفلاس",
      authority: "لجنة الإفلاس / المصدر الرسمي المعتمد",
      accessType: "OFFICIAL_API",
      status: "APPROVED",
      reliability: 1,
    },
  },
  {
    envKey: "DUE_DILIGENCE_IP_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_IP_ADAPTER_TOKEN",
    source: {
      key: "saudi_ip",
      nameAr: "الملكية الفكرية والعلامات",
      authority: "الهيئة السعودية للملكية الفكرية / المصدر المعتمد",
      accessType: "OFFICIAL_API",
      status: "APPROVED",
      reliability: 1,
    },
  },
  {
    envKey: "DUE_DILIGENCE_REGULATORY_ADAPTER_URL",
    tokenEnvKey: "DUE_DILIGENCE_REGULATORY_ADAPTER_TOKEN",
    source: {
      key: "saudi_regulatory",
      nameAr: "التراخيص والقرارات التنظيمية",
      authority: "الجهة التنظيمية المختصة / المصدر المعتمد",
      accessType: "OFFICIAL_API",
      status: "APPROVED",
      reliability: 1,
    },
  },
];

/** Only server-side environment configuration can enable a source. */
export function buildConfiguredConnectors(
  env: ConnectorEnvironment = process.env
): DueDiligenceConnector[] {
  const connectors: DueDiligenceConnector[] = [];
  for (const entry of SOURCE_CATALOG) {
    const endpoint = env[entry.envKey]?.trim();
    if (!endpoint) continue;
    const source = { ...entry.source, baseUrl: assertHttpsUrl(endpoint).origin };
    connectors.push(
      new NormalizedJsonConnector(
        source,
        endpoint,
        entry.tokenEnvKey ? env[entry.tokenEnvKey]?.trim() : undefined
      )
    );
  }
  return connectors;
}

export function dueDiligenceSourceCatalog(): DataSourceDefinition[] {
  return SOURCE_CATALOG.map((entry) => ({ ...entry.source }));
}
