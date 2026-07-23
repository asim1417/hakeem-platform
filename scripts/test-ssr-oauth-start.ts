/**
 * دخول SSR عبر /api/auth/oauth/start بلا Clerk JS على /sign-in.
 * npx tsx scripts/test-ssr-oauth-start.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildOAuthStartPath,
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

const start = buildOAuthStartPath({ provider: "google", nextUrl: "/dashboard/ask", mode: "sign-in" });
assert.ok(start.startsWith("/api/auth/oauth/start?"));
assert.ok(start.includes("provider=google"));
assert.ok(start.includes("next="));

const signInPage = fs.readFileSync(path.join(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
assert.ok(signInPage.includes("AuthOauthButtons"));
assert.equal(signInPage.includes("AuthClerkSignIn"), false);

const signUpPage = fs.readFileSync(path.join(root, "app/sign-up/[[...sign-up]]/page.tsx"), "utf8");
assert.ok(signUpPage.includes("AuthOauthButtons"));

const buttons = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(buttons.includes("المتابعة باستخدام Google"));
assert.ok(buttons.includes("المتابعة باستخدام Apple"));
assert.ok(buttons.includes("/api/auth/oauth/start"));
assert.equal(buttons.includes("@clerk/nextjs"), false);
assert.equal(buttons.includes('"use client"'), false);

const api = fs.readFileSync(path.join(root, "app/api/auth/oauth/start/route.ts"), "utf8");
assert.ok(api.includes("fetchClerkOAuthAuthorizeUrl"));
assert.ok(api.includes("/sso-callback"));

const signInLayout = fs.readFileSync(path.join(root, "app/sign-in/layout.tsx"), "utf8");
assert.equal(signInLayout.includes('from "@/components/providers/ClerkRoot"'), false);

console.log("test-ssr-oauth-start: OK");
