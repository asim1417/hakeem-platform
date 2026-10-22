"use client";

export interface ActionResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  code?: string;
  detail?: Record<string, unknown> | null;
}

const NETWORK_MESSAGE = "انقطع الاتصال بالخادم، ولم يُسجَّل شيء. تحقّق من الشبكة ثم أعد المحاولة.";

/** نداء مسار المكتب: يعيد رسالة الخادم المفهومة، ولا يكشف تفاصيل داخلية. */
export async function callEditorial<T = unknown>(method: "GET" | "POST" | "PUT", url: string, body?: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; code?: string; detail?: Record<string, unknown> | null } & T;
    if (!res.ok) {
      return { ok: false, status: res.status, message: json.message ?? "تعذّر تنفيذ العملية، ولم يُسجَّل شيء.", code: json.code, detail: json.detail ?? null };
    }
    return { ok: true, status: res.status, data: json };
  } catch {
    return { ok: false, status: 0, message: NETWORK_MESSAGE, code: "NETWORK" };
  }
}

export function postEditorial<T = unknown>(url: string, body?: unknown): Promise<ActionResult<T>> {
  return callEditorial<T>("POST", url, body);
}

/** أخطاء «قرّر غيري» و«تغيّر القرار المعروض»: لا تُعاد المحاولة؛ يُحدَّث الطابور. */
export function isStaleDecision(res: ActionResult): boolean {
  return res.status === 409 && (res.code === "ALREADY_DECIDED" || res.code === "CONFLICT" || res.code === "INVALID_STATE");
}
