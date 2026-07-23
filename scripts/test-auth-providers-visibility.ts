/**
 * وسائل الدخول الظاهرة — Google دائمًا عند التوفر، Apple فقط بعلم صريح.
 * npx tsx scripts/test-auth-providers-visibility.ts
 */
import assert from "node:assert/strict";
import {
  hasAnySignInProvider,
  isAppleAuthEnabled,
  isAuthLaunchReady,
  listVisibleAuthProviders,
} from "../lib/modules/auth/auth-providers";

delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.AUTH_APPLE_ENABLED;
delete process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED;
delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
delete process.env.CLERK_SECRET_KEY;

assert.equal(isAppleAuthEnabled(), false);
assert.equal(listVisibleAuthProviders().includes("apple"), false);

process.env.AUTH_APPLE_ENABLED = "1";
assert.equal(isAppleAuthEnabled(), true);
// بدون Clerk لا يظهر Apple
assert.equal(listVisibleAuthProviders().includes("apple"), false);

process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";
process.env.CLERK_SECRET_KEY = "sk_test_dummy";
assert.ok(listVisibleAuthProviders().includes("apple"));
assert.ok(hasAnySignInProvider());

process.env.GOOGLE_CLIENT_ID = "gid";
process.env.GOOGLE_CLIENT_SECRET = "gsec";
assert.equal(isAuthLaunchReady(), true);
assert.ok(listVisibleAuthProviders().includes("google"));

console.log("test-auth-providers-visibility: OK");
