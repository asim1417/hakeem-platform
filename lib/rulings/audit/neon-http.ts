/**
 * neon-http — استعلامات SQL عبر نقطة Neon على HTTPS (`https://<host>/sql`).
 *
 * لماذا: بيئات التنفيذ التي تمرّ عبر وكيل HTTPS لا تسمح باتصال قواعد البيانات الخام (TCP 5432)،
 * بينما نقطة SQL في Neon تعمل على المنفذ 443. كل طلب مستقلّ (لا جلسة)، فالقراءة فقط تُضمَن
 * بإعداد الدور نفسه (default_transaction_read_only=on) ويُتحقَّق منها قبل التشغيل.
 * لا يُطبع رابط الاتصال في أي رسالة خطأ.
 */

export interface NeonField {
  name: string;
  dataTypeID: number;
}

/** يحوّل قيمة معامِل إلى نصّ PostgreSQL (المصفوفات إلى صيغة '{"a","b"}'). */
export function serializeParam(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    const items = v.map((x) =>
      x === null || x === undefined ? "NULL" : `"${String(x).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`,
    );
    return `{${items.join(",")}}`;
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// أنواع PostgreSQL الشائعة بمعرّفاتها (pg_type.oid).
const BOOL = 16;
const NUMERIC_TYPES = new Set([20, 21, 23, 26, 700, 701, 1700]);
const JSON_TYPES = new Set([114, 3802]);

/** يحوّل قيمة نصّية راجعة إلى نوع JavaScript بحسب نوع العمود. */
export function parseValue(raw: unknown, dataTypeID: number): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;
  if (dataTypeID === BOOL) return raw === "t" || raw === "true";
  if (NUMERIC_TYPES.has(dataTypeID)) return Number(raw);
  if (JSON_TYPES.has(dataTypeID)) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function parseRows(fields: NeonField[], rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const f of fields) out[f.name] = parseValue(r[f.name], f.dataTypeID);
    return out;
  });
}

/** يُنشئ دالة استعلام عبر HTTPS لرابط اتصال Neon. */
export function neonHttpQuery(connectionString: string, timeoutMs = 120_000) {
  const u = new URL(connectionString);
  u.searchParams.delete("options"); // غير مدعوم عبر HTTP؛ القراءة فقط من إعداد الدور
  u.searchParams.delete("channel_binding");
  const conn = u.toString();
  const endpoint = `https://${u.hostname}/sql`;
  return async function query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "application/json",
          "Neon-Connection-String": conn,
          "Neon-Raw-Text-Output": "true",
          "Neon-Array-Mode": "false",
        },
        body: JSON.stringify({ query: sql, params: params.map(serializeParam) }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        fields?: NeonField[];
        rows?: Array<Record<string, unknown>>;
        message?: string;
      };
      if (!res.ok) throw new Error(`Neon HTTP ${res.status}: ${body.message ?? "خطأ غير معروف"}`);
      return parseRows(body.fields ?? [], body.rows ?? []) as T[];
    } finally {
      clearTimeout(timer);
    }
  };
}
