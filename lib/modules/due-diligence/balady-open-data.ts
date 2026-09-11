const BALADY_OPEN_DATA_API = "https://apiservices.balady.gov.sa/v1/momrah-services/open-data";
const MAX_BYTES = 2_000_000;
const MAX_ITEMS = 100;

type JsonRecord = Record<string, unknown>;

export type BaladyOpenDataItem = {
  id?: string;
  title?: string;
  year?: string;
  category?: string;
  files?: string[];
  created?: string;
  changed?: string;
};

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function asStrings(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value.map(asString).filter((item): item is string => Boolean(item)).slice(0, 20);
    return items.length ? items : undefined;
  }
  const single = asString(value);
  return single ? [single] : undefined;
}

function maybeParseJsonString(value: string): unknown {
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function collectObjects(value: unknown, depth = 0): JsonRecord[] {
  if (depth > 6 || value == null) return [];
  if (typeof value === "string") {
    const parsed = maybeParseJsonString(value);
    return parsed === value ? [] : collectObjects(parsed, depth + 1);
  }
  if (Array.isArray(value)) {
    const direct = value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
    if (direct.length) return direct.slice(0, MAX_ITEMS);
    return value.flatMap((item) => collectObjects(item, depth + 1)).slice(0, MAX_ITEMS);
  }
  if (typeof value === "object") {
    const object = value as JsonRecord;
    for (const key of ["rows", "data", "items", "results", "result", "records"]) {
      if (key in object) {
        const found = collectObjects(object[key], depth + 1);
        if (found.length) return found.slice(0, MAX_ITEMS);
      }
    }
    for (const child of Object.values(object)) {
      const found = collectObjects(child, depth + 1);
      if (found.length) return found.slice(0, MAX_ITEMS);
    }
  }
  return [];
}

function normalize(record: JsonRecord): BaladyOpenDataItem {
  return {
    id: asString(record.nid) ?? asString(record.id),
    title: asString(record.title) ?? asString(record.name),
    year: asString(record.field_year_g) ?? asString(record.year),
    category: asString(record.field_opendata_category) ?? asString(record.category) ?? asString(record.type),
    files: asStrings(record.field_file) ?? asStrings(record.file) ?? asStrings(record.url),
    created: asString(record.created),
    changed: asString(record.changed) ?? asString(record.updated),
  };
}

export async function fetchBaladyOpenDataCatalog(options: { limit?: number; signal?: AbortSignal } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), MAX_ITEMS);
  const url = new URL(BALADY_OPEN_DATA_API);
  url.searchParams.set("items_per_page", String(limit));
  if (url.protocol !== "https:" || url.hostname !== "apiservices.balady.gov.sa" || url.port) {
    throw new Error("Unexpected Balady open-data host.");
  }
  const response = await fetch(url, {
    signal: options.signal,
    redirect: "error",
    headers: {
      accept: "application/json,text/plain;q=0.8",
      "user-agent": "HakeemOpenDataHub/1.0 (+https://hakeemai.net)",
    },
  });
  if (!response.ok) throw new Error(`Balady Open Data HTTP ${response.status}`);
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("Balady open-data response exceeded safe size limit.");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) throw new Error("Balady open-data response exceeded safe size limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Balady open-data API returned non-JSON content.");
  }
  const items = collectObjects(parsed).map(normalize).filter((item) => item.id || item.title).slice(0, limit);
  return {
    source: "balady_open_data_api",
    authority: "وزارة البلديات والإسكان / منصة بلدي",
    fetchedAt: new Date().toISOString(),
    officialUrl: BALADY_OPEN_DATA_API,
    items,
    caveatAr: "هذه قائمة مجموعات بيانات مفتوحة وسياقية. لا تُعد نتيجة عن منشأة ولا تدخل في Risk Score إلا عبر موصل كيان مستقل بمعرفات موثقة.",
  };
}

export const __baladyOpenDataTest = { collectObjects, normalize, maybeParseJsonString };
