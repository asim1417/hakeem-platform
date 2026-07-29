/**
 * اختبارات جاهزية الإطلاق — مصادقة / حصّة / webhook / كوكي الجلسة.
 * تشغيل: npx tsx scripts/test-pre-launch-security.ts
 */
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { evaluateQuota } from "../lib/modules/billing/quota";
import { verifyMoyasarWebhookSecret } from "../lib/modules/billing/billing-events";
import { isValidOwnerSessionToken } from "../lib/modules/auth/session-cookie-verify";
import { safeDashboardNext } from "../lib/modules/auth/safe-next";
import { PRICING } from "../config/pricing";

function signSession(payload: object, secret: string) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

// ── Safe next ──
assert.equal(safeDashboardNext("/dashboard/ask"), "/dashboard/ask");
assert.equal(safeDashboardNext("//evil.com"), "/dashboard");
assert.equal(safeDashboardNext("/pricing"), "/dashboard");
assert.equal(safeDashboardNext("/admin/users"), "/admin/users");

// ── Session cookie verify ──
const prevSecret = process.env.AUTH_SECRET;
process.env.AUTH_SECRET = "test-secret-for-audit";
const good = signSession(
  { userId: "u1", role: "TRAINEE", name: "t", email: "t@x", exp: Date.now() + 60_000, nonce: "n" },
  "test-secret-for-audit"
);
assert.equal(isValidOwnerSessionToken(good), true);
assert.equal(isValidOwnerSessionToken("garbage"), false);
assert.equal(isValidOwnerSessionToken(good.slice(0, -2) + "xx"), false);
const expired = signSession(
  { userId: "u1", role: "TRAINEE", name: "t", email: "t@x", exp: Date.now() - 1000, nonce: "n" },
  "test-secret-for-audit"
);
assert.equal(isValidOwnerSessionToken(expired), false);
if (prevSecret === undefined) delete process.env.AUTH_SECRET;
else process.env.AUTH_SECRET = prevSecret;

// ── Quota pure logic ──
assert.equal(evaluateQuota({ subscriptionStatus: "active", freeQuotaUsed: 99, freeQuotaTotal: 20 }).allowed, true);
assert.equal(
  evaluateQuota({ subscriptionStatus: "free", freeQuotaUsed: PRICING.freeQuota, freeQuotaTotal: PRICING.freeQuota })
    .allowed,
  false
);

// ── Moyasar webhook: live without secret rejected ──
const prevWh = process.env.MOYASAR_WEBHOOK_SECRET;
const prevSk = process.env.MOYASAR_SECRET_KEY;
delete process.env.MOYASAR_WEBHOOK_SECRET;
delete process.env.MOYASAR_SECRET_KEY;
assert.equal(verifyMoyasarWebhookSecret({}).ok, true);
process.env.MOYASAR_SECRET_KEY = "sk_live_x";
assert.equal(verifyMoyasarWebhookSecret({}).ok, false);
assert.equal(verifyMoyasarWebhookSecret({}).reason, "webhook_secret_required");
process.env.MOYASAR_WEBHOOK_SECRET = "whsec";
assert.equal(verifyMoyasarWebhookSecret({ secret_token: "whsec" }).ok, true);
if (prevWh === undefined) delete process.env.MOYASAR_WEBHOOK_SECRET;
else process.env.MOYASAR_WEBHOOK_SECRET = prevWh;
if (prevSk === undefined) delete process.env.MOYASAR_SECRET_KEY;
else process.env.MOYASAR_SECRET_KEY = prevSk;

// ── Source guards (static) ──
import { readFileSync } from "fs";
import { join } from "path";
const root = join(__dirname, "..");
const sessionSrc = readFileSync(join(root, "lib/modules/auth/session.ts"), "utf8");
assert.match(sessionSrc, /role: "TRAINEE"/);
assert.match(sessionSrc, /ALLOW_UNAUTHENTICATED_GUEST/);
assert.doesNotMatch(sessionSrc, /update: \{ isActive: true, role: "SYSTEM_ADMIN" \}/);

const ownerSrc = readFileSync(join(root, "lib/modules/auth/ensure-owner.ts"), "utf8");
assert.match(ownerSrc, /OWNER_FORCE_PASSWORD_RESET/);
assert.match(ownerSrc, /forceReset/);

const loginSrc = readFileSync(join(root, "components/LoginForm.tsx"), "utf8");
assert.doesNotMatch(loginSrc, /setPassword\("Qalam-1703!"\)/);

const ownerLogin = readFileSync(join(root, "app/api/auth/owner-login/route.ts"), "utf8");
assert.doesNotMatch(ownerLogin, /OWNER_DEFAULT_PASSWORD/);

const legalChat = readFileSync(join(root, "app/api/legal-chat/route.ts"), "utf8");
assert.match(legalChat, /gateAdvancedUse/);
assert.match(legalChat, /settleAdvancedUse/);

const jaAsk = readFileSync(join(root, "app/api/judicial-assistant/ask/route.ts"), "utf8");
assert.match(jaAsk, /gateAdvancedUse/);

const pricing = readFileSync(join(root, "config/pricing.ts"), "utf8");
assert.doesNotMatch(pricing, /حتى ١٠ مقاعد مستخدمين/);
assert.doesNotMatch(pricing, /مساحة عمل مشتركة للقضايا/);

console.log("test-pre-launch-security: OK");
