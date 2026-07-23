/**
 * دخول SSR عبر /api/auth/oauth/start بلا Clerk JS على /sign-in.
 * npx tsx scripts/test-ssr-oauth-start.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildOAuthStartPath,
  buildClerkPortalSsoUrl,
  decodeClerkFrontendApiHost,
  clerkAccountPortalOrigin,
} from "../lib/modules/auth/clerk-oauth-start";

const root = process.cwd();

assert.equal(
  decodeClerkFrontendApiHost("pk_test_c2FmZS1lbGstNTAuY2xlcmsuYWNjb3VudHMuZGV2JA"),
  "safe-elk-50.clerk.accounts.dev"
);
assert.equal(
  clerkAccountPortalOrigin("safe-elk-50.clerk.accounts.dev"),
  "https://safe-elk-50.accounts.dev"
);

const portal = buildClerkPortalSsoUrl({
  provider: "google",
  redirectUrlComplete: "https://hakeem-platform.vercel.app/auth/continue?next=%2Fdashboard",
  publishableKey: "pk_test_c2FmZS1lbGstNTAuY2xlcmsuYWNjb3VudHMuZGV2JA",
});
assert.ok(portal);
assert.ok(portal!.includes("safe-elk-50.accounts.dev/sign-in/sso"));
assert.ok(portal!.includes("strategy=oauth_google"));
assert.ok(portal!.includes("redirect_url="));

const start = buildOAuthStartPath({ provider: "google", nextUrl: "/dashboard/ask", mode: "sign-in" });
assert.ok(start.startsWith("/api/auth/oauth/start?"));
assert.ok(start.includes("provider=google"));
assert.ok(start.includes("next="));

const signInPage = fs.readFileSync(path.join(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
assert.ok(signInPage.includes("AuthOauthButtons"));

const buttons = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(buttons.includes("المتابعة باستخدام Google"));
assert.ok(buttons.includes("/api/auth/google") || buttons.includes("buildOAuthStartPath"));
assert.equal(buttons.includes("@clerk/nextjs"), false);

const api = fs.readFileSync(path.join(root, "app/api/auth/oauth/start/route.ts"), "utf8");
assert.ok(api.includes("buildClerkPortalSsoUrl") || api.includes("/api/auth/google"));
assert.ok(api.includes("getGoogleOAuthConfig"));

const continuePage = fs.readFileSync(path.join(root, "app/auth/continue/page.tsx"), "utf8");
assert.ok(continuePage.includes("AuthContinueClient"));

const continueClient = fs.readFileSync(
  path.join(root, "components/auth/AuthContinueClient.tsx"),
  "utf8"
);
assert.ok(continueClient.includes("/#login"));
assert.ok(continueClient.includes("/api/auth/me"));

console.log("test-ssr-oauth-start: OK");
