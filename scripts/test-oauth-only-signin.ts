/**
 * يضمن أن واجهة الدخول V2 لا تعرض حقل بريد (AuthOauthOnly) مع إمكانية Rollback.
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

const oauthOnly = fs.readFileSync(path.join(root, "components/auth/AuthOauthOnly.tsx"), "utf8");
assert.ok(oauthOnly.includes("oauth_google"));
assert.ok(oauthOnly.includes("oauth_apple"));
assert.ok(oauthOnly.includes("authenticateWithRedirect"));
assert.equal(oauthOnly.includes("<SignIn"), false);
assert.equal(oauthOnly.includes("<SignUp"), false);
assert.ok(oauthOnly.includes("لا يتوفر الدخول بالبريد الإلكتروني"));
assert.ok(oauthOnly.includes("العودة إلى الصفحة الرئيسية"));

const signIn = fs.readFileSync(path.join(root, "components/auth/AuthClerkSignIn.tsx"), "utf8");
assert.ok(signIn.includes("AuthOauthOnly"));
assert.ok(signIn.includes("isAuthGatewayUxV2Enabled"));
assert.ok(signIn.includes("LegacyClerkSignIn"));

const signUp = fs.readFileSync(path.join(root, "components/auth/AuthClerkSignUp.tsx"), "utf8");
assert.ok(signUp.includes("AuthOauthOnly"));
assert.ok(signUp.includes("isAuthGatewayUxV2Enabled"));

const sso = fs.readFileSync(path.join(root, "app/sso-callback/page.tsx"), "utf8");
assert.ok(sso.includes("SsoCallbackClient"));

const ssoClient = fs.readFileSync(path.join(root, "components/auth/SsoCallbackClient.tsx"), "utf8");
assert.ok(ssoClient.includes("AuthenticateWithRedirectCallback"));
assert.ok(ssoClient.includes('signInUrl="/sign-in"'));
assert.ok(ssoClient.includes('signUpUrl="/sign-up"'));
assert.ok(ssoClient.includes("/auth/continue"));

const provider = fs.readFileSync(path.join(root, "components/providers/ClerkAppProvider.tsx"), "utf8");
assert.ok(provider.includes('signInUrl="/sign-in"'));
assert.ok(provider.includes('signUpUrl="/sign-up"'));

const csp = fs.readFileSync(path.join(root, "next.config.mjs"), "utf8");
assert.ok(csp.includes("fonts.googleapis.com"));
assert.ok(csp.includes("fonts.gstatic.com"));
assert.ok(csp.includes("accounts.google.com"));

assert.ok(oauthOnly.includes("window.location.origin"));
assert.ok(oauthOnly.includes("redirectUrlComplete"));

const home = fs.readFileSync(path.join(root, "components/home/HomeHero.tsx"), "utf8");
assert.equal(home.includes("تخطّي إلى الدخول"), false);
assert.ok(home.includes("/sign-in"));
assert.ok(home.includes("ابدأ مجانًا"));
assert.ok(home.includes("HomeAuthActions"));
assert.equal(home.includes('"use client"'), false);

const dash = fs.readFileSync(path.join(root, "app/dashboard/page.tsx"), "utf8");
assert.ok(dash.includes("isNewUser"));
assert.ok(dash.includes("ابدأ من هنا") || dash.includes("مرحبًا"));

console.log("test-oauth-only-signin: OK");
