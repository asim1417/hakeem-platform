/**
 * يضمن بوابة الدخول OAuth (SSR) مع إمكانية Rollback للمكوّنات القديمة.
 * npx tsx scripts/test-oauth-only-signin.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isAuthGatewayUxV2Enabled } from "../lib/modules/config/auth-gateway";
import { safeDashboardNext, continueUrl, signUpWithNext } from "../lib/modules/auth/safe-next";

const root = process.cwd();

assert.equal(isAuthGatewayUxV2Enabled(), true);
process.env.AUTH_GATEWAY_UX_V2 = "0";
assert.equal(isAuthGatewayUxV2Enabled(), false);
delete process.env.AUTH_GATEWAY_UX_V2;
assert.equal(isAuthGatewayUxV2Enabled(), true);

assert.equal(safeDashboardNext("/dashboard/ask"), "/dashboard/ask");
assert.equal(safeDashboardNext("//evil.com"), "/dashboard");
assert.equal(safeDashboardNext("https://evil.com"), "/dashboard");
assert.equal(safeDashboardNext("/documents"), "/documents");
assert.equal(continueUrl("/dashboard/ask"), "/auth/continue?next=%2Fdashboard%2Fask");
assert.ok(signUpWithNext("/dashboard/ask").includes("next="));

const buttons = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(buttons.includes("oauth") || buttons.includes("/api/auth/oauth/start"));
assert.ok(buttons.includes("المتابعة باستخدام Google"));
assert.ok(buttons.includes("المتابعة باستخدام Apple"));
assert.equal(buttons.includes('from "@clerk/nextjs"'), false);

const api = fs.readFileSync(path.join(root, "app/api/auth/oauth/start/route.ts"), "utf8");
assert.ok(api.includes("fetchClerkOAuthAuthorizeUrl"));
assert.ok(api.includes("/sso-callback"));

const signInPage = fs.readFileSync(path.join(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
assert.ok(signInPage.includes("AuthOauthButtons"));

const signUpPage = fs.readFileSync(path.join(root, "app/sign-up/[[...sign-up]]/page.tsx"), "utf8");
assert.ok(signUpPage.includes("AuthOauthButtons"));

// مكوّنات Rollback ما زالت موجودة ومعزولة
const oauthShell = fs.readFileSync(path.join(root, "components/auth/AuthOauthOnly.tsx"), "utf8");
assert.equal(oauthShell.includes('from "@clerk/nextjs"'), false);
assert.ok(oauthShell.includes("AuthOauthOnlyInner"));

const oauthInner = fs.readFileSync(
  path.join(root, "components/auth/AuthOauthOnlyInner.tsx"),
  "utf8"
);
assert.ok(oauthInner.includes("authenticateWithRedirect"));
assert.ok(oauthInner.includes("window.location.origin"));

const sso = fs.readFileSync(path.join(root, "app/sso-callback/page.tsx"), "utf8");
assert.ok(sso.includes("SsoCallbackClient"));

const ssoClient = fs.readFileSync(path.join(root, "components/auth/SsoCallbackClient.tsx"), "utf8");
assert.ok(ssoClient.includes("AuthenticateWithRedirectCallback"));
assert.equal(ssoClient.includes('from "@clerk/nextjs"'), false);

const provider = fs.readFileSync(path.join(root, "components/providers/ClerkAppProvider.tsx"), "utf8");
assert.ok(provider.includes('signInUrl="/sign-in"'));
assert.ok(provider.includes('signUpUrl="/sign-up"'));

const csp = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8");
assert.ok(csp.includes("fonts.googleapis.com"));
assert.ok(csp.includes("accounts.google.com"));

const home = fs.readFileSync(path.join(root, "components/home/HomeHero.tsx"), "utf8");
assert.equal(home.includes("تخطّي إلى الدخول"), false);
assert.ok(home.includes("/sign-in"));
assert.ok(home.includes("HomeAuthActions"));
assert.equal(home.includes('"use client"'), false);

const dash = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
assert.ok(dash.includes("isNewUser"));
assert.ok(dash.includes("ابدأ من هنا") || dash.includes("مرحبًا"));

console.log("test-oauth-only-signin: OK");
