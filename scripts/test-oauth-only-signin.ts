/**
 * يضمن أن واجهة الدخول لا تعرض حقل بريد ولا مكوّن Clerk الجاهز.
 * npx tsx scripts/test-oauth-only-signin.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const oauthOnly = fs.readFileSync(path.join(root, "components/auth/AuthOauthOnly.tsx"), "utf8");
assert.ok(oauthOnly.includes("oauth_google"));
assert.ok(oauthOnly.includes("oauth_apple"));
assert.ok(oauthOnly.includes("authenticateWithRedirect"));
assert.equal(oauthOnly.includes("<SignIn"), false);
assert.equal(oauthOnly.includes("<SignUp"), false);
assert.equal(oauthOnly.includes("formFieldInput"), false);
assert.ok(oauthOnly.includes("لا يتوفر الدخول بالبريد الإلكتروني"));

const signIn = fs.readFileSync(path.join(root, "components/auth/AuthClerkSignIn.tsx"), "utf8");
assert.ok(signIn.includes("AuthOauthOnly"));
assert.equal(signIn.includes("from \"@clerk/nextjs\""), false);
assert.equal(signIn.includes("<SignIn"), false);

const signUp = fs.readFileSync(path.join(root, "components/auth/AuthClerkSignUp.tsx"), "utf8");
assert.ok(signUp.includes("AuthOauthOnly"));
assert.equal(signUp.includes("<SignUp"), false);

const sso = fs.readFileSync(path.join(root, "app/sso-callback/page.tsx"), "utf8");
assert.ok(sso.includes("AuthenticateWithRedirectCallback"));

console.log("test-oauth-only-signin: OK");
