/**
 * جلسة أولى الطرف بعد Google — الحل الجذري لـ Safari.
 * npx tsx scripts/test-firstparty-session.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const establish = fs.readFileSync(
  path.join(root, "lib/modules/auth/establish-session.ts"),
  "utf8"
);
assert.ok(establish.includes("provisionOAuthUser"));
assert.ok(establish.includes("ensureLocalUserFromClerk"));
assert.ok(establish.includes("__session"));
assert.ok(establish.indexOf("provisionOAuthUser") < establish.indexOf("ensureLocalUserFromClerk"));

const googleStart = fs.readFileSync(path.join(root, "app/api/auth/google/route.ts"), "utf8");
assert.ok(googleStart.includes("buildGoogleAuthUrl"));
assert.ok(googleStart.includes("GOOGLE_STATE_COOKIE"));

const googleCb = fs.readFileSync(
  path.join(root, "app/api/auth/callback/google/route.ts"),
  "utf8"
);
assert.ok(googleCb.includes("establishFirstPartySession"));
assert.ok(googleCb.includes("exchangeGoogleCodeForProfile"));

const oauthStart = fs.readFileSync(
  path.join(root, "app/api/auth/oauth/start/route.ts"),
  "utf8"
);
assert.ok(oauthStart.includes("getGoogleOAuthConfig"));
assert.ok(oauthStart.includes("/api/auth/google"));

const continuePage = fs.readFileSync(path.join(root, "app/auth/continue/page.tsx"), "utf8");
assert.ok(continuePage.includes("claimSessionFromClerkReturn"));

const buttons = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(buttons.includes("isGoogleOAuthConfigured"));
assert.ok(buttons.includes("/api/auth/google"));

const mw = fs.readFileSync(path.join(root, "middleware.ts"), "utf8");
assert.ok(mw.includes("/api/auth/google"));
assert.ok(mw.includes("/api/auth/callback/google"));

console.log("test-firstparty-session: OK");
