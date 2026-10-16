/**
 * اختبار مسار /oauth/authorize الفعلي: CSRF بالأصل، حجب المحاولات الفاشلة، ونجاح المفتاح الصحيح.
 * npx tsx scripts/test-mcp-authorize-route.ts
 */
import assert from "node:assert/strict";
import { s256 } from "@/lib/mcp/oauth";

const KEY = "hakeem-route-test-key-32-chars-long";
process.env.HAKEEM_MCP_KEY = KEY;

async function main() {
  const { POST } = await import("@/app/oauth/authorize/route");
  const verifier = "b".repeat(50);
  const base = {
    client_id: "https://claude.ai/oauth/mcp-oauth-client-metadata",
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    state: "st",
    code_challenge: s256(verifier),
    code_challenge_method: "S256",
    scope: "mcp:read",
    resource: "",
  };
  const post = (key: string, headers: Record<string, string> = {}) => {
    const body = new URLSearchParams({ ...base, connector_key: key });
    return POST(
      new Request("https://hakeemai.net/oauth/authorize", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "9.9.9.9", ...headers },
        body,
      })
    );
  };

  // أصل مخالف → 403 ولا يُحتسب كمحاولة مفتاح.
  assert.equal((await post(KEY, { origin: "https://evil.example" })).status, 403);

  // مفتاح صحيح من الأصل نفسه → 303 إلى redirect مع code وiss.
  const ok = await post(KEY, { origin: "https://hakeemai.net" });
  assert.equal(ok.status, 303);
  const loc = new URL(ok.headers.get("location") ?? "");
  assert.equal(loc.origin + loc.pathname, "https://claude.ai/api/mcp/auth_callback");
  assert.ok(loc.searchParams.get("code")?.startsWith("hk1."));
  assert.equal(loc.searchParams.get("state"), "st");

  // 5 فشل ثم الحجب (429 + Retry-After) حتى مع المفتاح الصحيح.
  for (let i = 0; i < 5; i++) assert.equal((await post("wrong-key-" + i)).status, 401);
  const blocked = await post(KEY);
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);

  // عنوان آخر غير متأثر.
  assert.equal((await post(KEY, { "x-forwarded-for": "8.8.8.8" })).status, 303);

  console.log("mcp authorize route ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
