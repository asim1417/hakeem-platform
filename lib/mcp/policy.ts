/**
 * سياسة الوصول إلى /mcp — مغلقة افتراضيًا.
 *  - auth   : مفتاح مشترك أو سرّ تصاريح مضبوط → المصادقة إلزامية.
 *  - open   : لا شيء منهما + علم صريح HAKEEM_MCP_ALLOW_OPEN=1 → مفتوح (قرار واعٍ).
 *  - closed : لا شيء ولا علم → يُرفض الطلب بـ 503 بدل كشف المدوّنة بصمت (نسخ المعاينة مثلًا).
 * تُقرأ لكل طلب (لا عند تحميل الوحدة).
 */
import { mcpSharedKey, mcpTokenSecret } from "@/lib/mcp/config";

export type McpAccessMode = "auth" | "open" | "closed";

type Env = Record<string, string | undefined>;

export function mcpAccessMode(env: Env = process.env): McpAccessMode {
  if (mcpSharedKey(env) || mcpTokenSecret(env)) return "auth";
  const flag = (env.HAKEEM_MCP_ALLOW_OPEN ?? "").trim().toLowerCase();
  return flag === "1" || flag === "true" ? "open" : "closed";
}

export function mcpClosedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "mcp_not_configured",
      message:
        "خادم حكيم MCP غير مهيّأ: اضبط HAKEEM_MCP_KEY أو MCP_TOKEN_SECRET، أو HAKEEM_MCP_ALLOW_OPEN=1 للفتح الصريح.",
    }),
    {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    }
  );
}
