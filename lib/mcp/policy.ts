/**
 * سياسة الوصول إلى /mcp — مغلقة افتراضيًا.
 *  - key    : المفتاح مضبوط → المصادقة إلزامية.
 *  - open   : لا مفتاح + علم صريح HAKEEM_MCP_ALLOW_OPEN=1 → مفتوح (قرار واعٍ).
 *  - closed : لا مفتاح ولا علم → يُرفض الطلب بـ 503 بدل كشف المدوّنة بصمت.
 * ملف بلا اعتماد على Node ويُقرأ لكل طلب (لا عند تحميل الوحدة).
 */
export type McpAccessMode = "key" | "open" | "closed";

type Env = Record<string, string | undefined>;

export function mcpAccessMode(env: Env = process.env): McpAccessMode {
  if ((env.HAKEEM_MCP_KEY ?? "").trim()) return "key";
  const flag = (env.HAKEEM_MCP_ALLOW_OPEN ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" ? "open" : "closed";
}

export function mcpClosedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "mcp_not_configured",
      message: "خادم حكيم MCP غير مهيّأ: اضبط HAKEEM_MCP_KEY، أو HAKEEM_MCP_ALLOW_OPEN=1 للفتح الصريح.",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}
