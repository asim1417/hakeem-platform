/**
 * وسائل الدخول الظاهرة — Google عند التوفر؛ Apple/Microsoft/الهاتف/Magic خلف أعلام معطّلة.
 * npx tsx scripts/test-auth-providers-visibility.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  hasAnySignInProvider,
  isAppleAuthEnabled,
  isAuthLaunchReady,
  isMagicLinkPublicEnabled,
  isMicrosoftPublicAuthEnabled,
  isMicrosoftPublicSignInAvailable,
  isPhoneAuthEnabled,
  isPhoneSignInAvailable,
  listVisibleAuthProviders,
} from "../lib/modules/auth/auth-providers";

const root = process.cwd();

for (const key of [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "AUTH_APPLE_ENABLED",
  "NEXT_PUBLIC_AUTH_APPLE_ENABLED",
  "AUTH_MICROSOFT_PUBLIC_ENABLED",
  "NEXT_PUBLIC_AUTH_MICROSOFT_PUBLIC_ENABLED",
  "AUTH_PHONE_ENABLED",
  "NEXT_PUBLIC_AUTH_PHONE_ENABLED",
  "AUTH_MAGIC_LINK_PUBLIC_ENABLED",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
]) {
  delete process.env[key];
}

assert.equal(isAppleAuthEnabled(), false);
assert.equal(isMicrosoftPublicAuthEnabled(), false);
assert.equal(isPhoneAuthEnabled(), false);
assert.equal(isMagicLinkPublicEnabled(), false);
assert.equal(listVisibleAuthProviders().includes("apple"), false);
assert.equal(isMicrosoftPublicSignInAvailable(), false);
assert.equal(isPhoneSignInAvailable(), false);

process.env.AUTH_APPLE_ENABLED = "1";
assert.equal(isAppleAuthEnabled(), true);
assert.equal(listVisibleAuthProviders().includes("apple"), false);

process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";
process.env.CLERK_SECRET_KEY = "sk_test_dummy";
assert.ok(listVisibleAuthProviders().includes("apple"));
assert.ok(hasAnySignInProvider());

process.env.AUTH_MICROSOFT_PUBLIC_ENABLED = "1";
assert.equal(isMicrosoftPublicAuthEnabled(), true);
assert.equal(isMicrosoftPublicSignInAvailable(), true);

process.env.AUTH_PHONE_ENABLED = "true";
assert.equal(isPhoneAuthEnabled(), true);
assert.equal(isPhoneSignInAvailable(), true);

process.env.AUTH_MAGIC_LINK_PUBLIC_ENABLED = "yes";
assert.equal(isMagicLinkPublicEnabled(), true);

process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsec";
assert.equal(isAuthLaunchReady(), true);
assert.ok(listVisibleAuthProviders().includes("google"));

const providersRoute = fs.readFileSync(
  path.join(root, "app/api/auth/providers/route.ts"),
  "utf8"
);
assert.ok(providersRoute.includes("isMicrosoftPublicSignInAvailable"));
assert.ok(providersRoute.includes("isPhoneSignInAvailable"));
assert.ok(providersRoute.includes("isMagicLinkPublicEnabled"));
assert.equal(providersRoute.includes("isMicrosoftOAuthConfigured"), false);

const loginForm = fs.readFileSync(path.join(root, "components/LoginForm.tsx"), "utf8");
assert.equal(loginForm.includes("Qalam-1703"), false);
assert.ok(providersRoute.includes("magicLink"));
assert.ok(loginForm.includes("providers.magicLink"));
assert.ok(loginForm.includes("providers.microsoft"));
assert.ok(loginForm.includes("openOAuthPopup"));

const oauthButtons = fs.readFileSync(
  path.join(root, "components/auth/AuthOauthButtons.tsx"),
  "utf8"
);
assert.ok(oauthButtons.includes("showApple"));
assert.equal(oauthButtons.includes("/api/auth/microsoft"), false);
assert.equal(oauthButtons.includes("magic"), false);

console.log("test-auth-providers-visibility: OK");
