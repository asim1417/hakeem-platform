"use client";

export interface ActionResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  message?: string;
  code?: string;
}

/** نداء مسار المكتب: يعيد رسالة الخادم المفهومة، ولا يكشف تفاصيل داخلية. */
export async function postEditorial<T = unknown>(url: string, body?: unknown): Promise<ActionResult<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; code?: string } & T;
    if (!res.ok) return { ok: false, status: res.status, message: json.message ?? "تعذّر تنفيذ العملية.", code: json.code };
    return { ok: true, status: res.status, data: json };
  } catch {
    return { ok: false, status: 0, message: "تعذّر الاتصال بالخادم. تحقّق من الشبكة ثم أعد المحاولة." };
  }
}
