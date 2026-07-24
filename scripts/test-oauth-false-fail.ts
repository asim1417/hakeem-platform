/**
 * لا وميض فشل كاذب بعد Google OAuth.
 * npx tsx scripts/test-oauth-false-fail.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const continueClient = read("components/auth/AuthContinueClient.tsx");
assert.ok(continueClient.includes("جارٍ إكمال تسجيل الدخول"));
assert.ok(continueClient.includes("ما زلنا نكمل تسجيل الدخول"));
assert.equal(continueClient.includes('setStatus("fail")'), false);
assert.equal(continueClient.includes("تعذّر تحميل بوابة الدخول"), false);
assert.ok(continueClient.includes("/api/auth/me"));
assert.ok(/slowAfterAttempts\s*=\s*\d+/.test(continueClient) || continueClient.includes("slowAfterAttempts"));

const mw = read("middleware.ts");
assert.ok(mw.includes("/auth/continue(.*)"));
assert.ok(mw.includes("/sso-callback(.*)"));
assert.ok(mw.includes("/api/auth/claim-clerk-return(.*)"));

const callback = read("app/api/auth/callback/google/route.ts");
assert.ok(callback.includes("attachLoginSessionCookie") || callback.includes("mirrorLoginSessionCookie"));
assert.ok(callback.includes("NextResponse.redirect"));

const session = read("lib/modules/auth/session.ts");
assert.ok(session.includes("attachLoginSessionCookie"));
assert.ok(session.includes("mirrorLoginSessionCookie"));

const continuePage = read("app/auth/continue/page.tsx");
assert.ok(continuePage.includes("/api/auth/claim-clerk-return"));
assert.equal(continuePage.includes("claimSessionFromClerkReturn"), false);
assert.ok(continuePage.includes("getCurrentUser"));

const claimApi = read("app/api/auth/claim-clerk-return/route.ts");
assert.ok(claimApi.includes("claimSessionFromClerkReturn"));

const authLayout = read("app/auth/layout.tsx");
assert.equal(authLayout.includes('from "@/components/providers/ClerkRoot"'), false);

const authError = read("app/auth/error.tsx");
assert.ok(authError.includes("تعذّر إكمال تسجيل الدخول"));
assert.equal(authError.includes("تعذّر فتح الصفحة"), false);

const sso = read("components/auth/SsoCallbackClient.tsx");
assert.equal(sso.includes("FALLBACK_MS"), false);
assert.ok(sso.includes("AuthenticateWithRedirectCallback") || sso.includes("Callback"));
assert.ok(sso.includes("slow"));
// يجب ألا يُزال Callback عند البطء
assert.ok(sso.includes("ما زلنا نكمل تسجيل الدخول"));

console.log("test-oauth-false-fail: OK");
