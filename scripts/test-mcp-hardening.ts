/**
 * اختبار تشديد MCP: سياسة الإغلاق الافتراضي، محدّد المعدّل، أصل الطلب الموثوق، مدة رمز التفويض.
 * npx tsx scripts/test-mcp-hardening.ts
 */
import assert from "node:assert/strict";
import { mcpAccessMode } from "@/lib/mcp/policy";
import { clientKey, createFailureLimiter } from "@/lib/mcp/rate-limit";
import {
  allowedMcpHosts,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  mcpResourceUrl,
  publicOrigin,
  s256,
} from "@/lib/mcp/oauth";

// ── سياسة الوصول ──
assert.equal(mcpAccessMode({}), "closed");
assert.equal(mcpAccessMode({ HAKEEM_MCP_KEY: "   " }), "closed");
assert.equal(mcpAccessMode({ HAKEEM_MCP_KEY: "k".repeat(32) }), "auth");
assert.equal(mcpAccessMode({ MCP_TOKEN_SECRET: "s".repeat(32) }), "auth", "سرّ التصاريح وحده يكفي للمصادقة");
assert.equal(mcpAccessMode({ MCP_TOKEN_SECRET: "short" }), "closed", "سرّ قصير لا يُعتد به");
assert.equal(
  mcpAccessMode({ HAKEEM_MCP_KEY: "k".repeat(32), HAKEEM_MCP_SHARED_KEY_DISABLED: "1" }),
  "closed",
  "المفتاح المشترك الموقوف لا يفتح المصادقة"
);
assert.equal(mcpAccessMode({ HAKEEM_MCP_ALLOW_OPEN: "1" }), "open");
assert.equal(mcpAccessMode({ HAKEEM_MCP_ALLOW_OPEN: "true" }), "open");
assert.equal(mcpAccessMode({ HAKEEM_MCP_ALLOW_OPEN: "0" }), "closed");
assert.equal(mcpAccessMode({ HAKEEM_MCP_KEY: "k".repeat(32), HAKEEM_MCP_ALLOW_OPEN: "1" }), "auth", "المفتاح يغلب علم الفتح");

// ── محدّد المعدّل ──
let t = 1_000_000;
const limiter = createFailureLimiter({ max: 3, windowMs: 60_000, maxKeys: 4, now: () => t });
assert.equal(limiter.blockedFor("a"), 0);
limiter.recordFailure("a");
limiter.recordFailure("a");
assert.equal(limiter.blockedFor("a"), 0, "دون الحد لا حجب");
limiter.recordFailure("a");
assert.ok(limiter.blockedFor("a") > 0, "عند الحد يُحجب");
assert.equal(limiter.blockedFor("b"), 0, "العناوين مستقلة");
t += 61_000;
assert.equal(limiter.blockedFor("a"), 0, "تنقضي النافذة");
limiter.recordFailure("a");
limiter.reset("a");
assert.equal(limiter.blockedFor("a"), 0);
for (let i = 0; i < 50; i++) limiter.recordFailure(`k${i}`); // لا يتضخم السجل
limiter.recordFailure("z");
assert.equal(limiter.blockedFor("z"), 0);

assert.equal(clientKey(new Request("https://x.test", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } })), "1.2.3.4");
assert.equal(clientKey(new Request("https://x.test")), "unknown");

// ── أصل الطلب الموثوق ──
const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });
assert.equal(publicOrigin(req("https://hakeemai.net/oauth/authorize")), "https://hakeemai.net");
assert.equal(
  publicOrigin(req("http://internal:3000/x", { "x-forwarded-host": "hakeemai.net", "x-forwarded-proto": "https" })),
  "https://hakeemai.net",
  "مضيف معروف من الترويسة يُقبل"
);
assert.equal(
  publicOrigin(req("https://hakeemai.net/x", { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" })),
  "https://hakeemai.net",
  "مضيف مجهول من الترويسة يُتجاهل"
);
assert.equal(
  publicOrigin(req("http://hakeemai.net/x", { "x-forwarded-proto": "javascript" })),
  "https://hakeemai.net",
  "بروتوكول غير http/https يُتجاهل، وغير المحلي يُجبر على https"
);
assert.equal(publicOrigin(req("http://localhost:3000/x")), "http://localhost:3000", "التطوير المحلي يبقى http");

const hosts = allowedMcpHosts({ NEXT_PUBLIC_SITE_URL: "https://hakeemsa.com/", MCP_ALLOWED_HOSTS: "a.test, B.test" });
assert.ok(hosts.has("hakeemsa.com") && hosts.has("a.test") && hosts.has("b.test") && hosts.has("hakeemai.net"));
assert.ok(!allowedMcpHosts({ NEXT_PUBLIC_SITE_URL: "not a url" }).has("not a url"));

// ── رمز التفويض قصير العمر ──
const secret = "hakeem-test-key-32-characters-long";
const redirect = "https://claude.ai/api/mcp/auth_callback";
const clientId = "https://claude.ai/oauth/mcp-oauth-client-metadata";
const verifier = "a".repeat(50);
const resource = mcpResourceUrl("https://hakeemai.net");
const now = Math.floor(Date.now() / 1000);
const code = createAuthorizationCode({ secret, clientId, redirectUri: redirect, codeChallenge: s256(verifier), resource, now });
const exchange = (at: number) =>
  exchangeAuthorizationCode({ secret, code, clientId, redirectUri: redirect, codeVerifier: verifier, now: at });
const realNow = Date.now;
try {
  Date.now = () => (now + 60) * 1000;
  assert.ok(!("error" in exchange(now + 60)), "بعد 60 ثانية ما زال صالحًا");
  Date.now = () => (now + 150) * 1000;
  assert.deepEqual(exchange(now + 150), { error: "invalid_grant" }, "بعد 150 ثانية منتهٍ");
} finally {
  Date.now = realNow;
}

console.log("mcp hardening ok");
