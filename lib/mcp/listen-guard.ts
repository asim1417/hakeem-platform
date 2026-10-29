/**
 * HKM-054 — رفض `subscriptions/listen` فورًا.
 *
 * السبب (سجل /mcp في الإنتاج 29/10، بعد #922): طلبات POST بطريقة `subscriptions/listen` (مواصفة MCP 2026) تفتح بثّ SSE
 * لا ينتهي، فتبلغ حد Vercel (300 ث) وتُسجَّل «Task timed out». وهي مصدر أخطاء المهلة على /mcp (732 في أربعة أشهر).
 * خادم حكيم لا ينشر أحداث تغيّر (لا notify ولا bus)، فالاشتراك لا يحمل شيئًا قط.
 * الرد هو رد الحزمة نفسها حين تُضبط maxSubscriptions = 0 (mcp-handler لا يمرّر الخيار): خطأ JSON-RPC ‎-32603
 * «Subscription limit reached» داخل الجسم بحالة 200 قبل الإقرار، فيفهمه العميل رفضًا لا انقطاعًا.
 */

export const LISTEN_METHOD = "subscriptions/listen";

/** معرّف طلب listen إن كان الجسم طلبًا مفردًا بهذه الطريقة، وإلا undefined. نقية. */
export function listenRequestId(body: unknown): string | number | null | undefined {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const m = body as { method?: unknown; id?: unknown };
  if (m.method !== LISTEN_METHOD) return undefined;
  return typeof m.id === "string" || typeof m.id === "number" ? m.id : null;
}

export function listenRefusal(id: string | number | null): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "Subscription limit reached" }, id }, { status: 200 });
}

/** يلفّ معالج /mcp: listen يُرفض فورًا، وكل ما عداه يمرّ كما هو. */
export function withListenRefused(inner: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "POST" && (req.headers.get("content-type") || "").includes("application/json")) {
      const body = await req.clone().json().catch(() => null);
      const id = listenRequestId(body);
      if (id !== undefined) return listenRefusal(id);
    }
    return inner(req);
  };
}
