/**
 * npx tsx scripts/test-password-reset.ts
 * اختبار منطق استعادة كلمة المرور (رمز HMAC + كشف كلمة المرور المحلية).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Module from "node:module";

// server-only يرفض الاستيراد خارج Next — نتجاوزه في الاختبار فقط.
type NodeLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const mod = Module as unknown as { _load: NodeLoad };
const originalLoad = mod._load.bind(Module);
mod._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad(request, parent, isMain);
};

async function main() {
  process.env.AUTH_SECRET = "test-password-reset-secret-do-not-use";

  const {
    hasUsableLocalPassword,
    issuePasswordResetToken,
    verifyPasswordResetToken,
    passwordResetUrl,
  } = await import("../lib/modules/auth/password-reset");

  assert.equal(hasUsableLocalPassword("$2b$12$abcdefghijklmnopqrstuv"), true);
  assert.equal(hasUsableLocalPassword("$2a$10$abcdefghijklmnopqrstuv"), true);
  assert.equal(hasUsableLocalPassword("oauth-google:abc"), false);
  assert.equal(hasUsableLocalPassword("clerk:user_123"), false);
  assert.equal(hasUsableLocalPassword("no-password"), false);
  assert.equal(hasUsableLocalPassword(null), false);
  assert.equal(hasUsableLocalPassword(""), false);

  const { token, exp } = issuePasswordResetToken("Lawyer@Example.com");
  assert.ok(token.includes("."));
  assert.ok(exp > Date.now());

  const verified = verifyPasswordResetToken(token);
  assert.deepEqual(verified, { email: "lawyer@example.com" });

  assert.equal(verifyPasswordResetToken("bad.token"), null);
  assert.equal(verifyPasswordResetToken(""), null);
  assert.equal(verifyPasswordResetToken(`${token}x`), null);

  const url = passwordResetUrl(token);
  assert.ok(url.includes("/reset-password?token="));

  const root = resolve(process.cwd());
  const mw = readFileSync(resolve(root, "middleware.ts"), "utf8");
  assert.ok(mw.includes("/forgot-password"));
  assert.ok(mw.includes("/reset-password"));
  assert.ok(mw.includes("/api/auth/forgot-password"));
  assert.ok(mw.includes("/api/auth/password-login"));

  const oauth = readFileSync(resolve(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
  assert.ok(oauth.includes("EmailPasswordSignIn"));
  assert.ok(oauth.includes("/forgot-password"));

  const hero = readFileSync(resolve(root, "components/home/HomeHero.tsx"), "utf8");
  assert.ok(hero.includes("/forgot-password"));
  assert.ok(hero.includes("HomePublicFooter"));

  console.log("test-password-reset: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
