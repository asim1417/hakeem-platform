/**
 * وسائل الدخول الظاهرة — Google دائمًا عند التوفر، Apple فقط بعلم صريح.
 * npx tsx scripts/test-auth-providers-visibility.ts
 */
import assert from "node:assert/strict";
import {
  AUTH_FEATURE_FLAGS,
  getAccountSecurityFeatures,
  hasAnySignInProvider,
  isIdentifierFormEnabled,
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
for (const flag of AUTH_FEATURE_FLAGS) {
  delete process.env[flag];
  delete process.env[`NEXT_PUBLIC_${flag}`];
}

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

// الوسائل الجديدة مخفية افتراضيًا حتى مع Clerk
assert.deepEqual(listVisibleAuthProviders(), ["google", "apple"]);
assert.deepEqual(getAccountSecurityFeatures(), { mfa: false, organizations: false });

process.env.AUTH_MICROSOFT_ENABLED = "true";
process.env.NEXT_PUBLIC_AUTH_EMAIL_CODE_ENABLED = "1";
process.env.AUTH_PHONE_ENABLED = "yes";
process.env.AUTH_MFA_ENABLED = "1";
process.env.AUTH_ORGANIZATIONS_ENABLED = "1";
assert.deepEqual(listVisibleAuthProviders(), ["google", "microsoft", "apple", "email", "phone"]);
assert.deepEqual(getAccountSecurityFeatures(), { mfa: true, organizations: true });

// نموذج حكيم العربي: يحتاج علمه + بريد أو جوال مفعّل
assert.equal(isIdentifierFormEnabled(), false);
process.env.AUTH_IDENTIFIER_FORM_ENABLED = "1";
assert.equal(isIdentifierFormEnabled(), true);

process.env.AUTH_PHONE_ENABLED = "0";
assert.equal(listVisibleAuthProviders().includes("phone"), false);

// بدون Clerk لا تظهر أي وسيلة تعتمد عليه، ويبقى Google الأصلي
delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
delete process.env.CLERK_SECRET_KEY;
assert.deepEqual(listVisibleAuthProviders(), ["google"]);
assert.deepEqual(getAccountSecurityFeatures(), { mfa: false, organizations: false });
assert.equal(isIdentifierFormEnabled(), false);

console.log("test-auth-providers-visibility: OK");
