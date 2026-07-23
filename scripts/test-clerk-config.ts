/**
 * اختبار إعداد Clerk + نصوص الدخول العربية.
 * npx tsx scripts/test-clerk-config.ts
 */
import assert from "node:assert/strict";
import {
  isClerkConfigured,
  clerkAppearance,
  clerkLocalization,
} from "../lib/modules/auth/clerk-config";

assert.equal(typeof isClerkConfigured(), "boolean");
assert.equal(isClerkConfigured(), false);
assert.equal(clerkAppearance.variables.colorPrimary, "#0E3435");
assert.ok(String(clerkAppearance.elements.formButtonPrimary).includes("#0E3435"));
assert.equal(clerkLocalization.locale, "ar-SA");
assert.equal(clerkLocalization.signIn?.start?.title, "مرحبًا بعودتك إلى حكيم");
assert.equal(
  clerkLocalization.signIn?.start?.subtitle,
  "ادخل عبر Google أو Apple أو Microsoft"
);
assert.equal(clerkLocalization.signUp?.start?.title, "إنشاء حساب في حكيم");
assert.match(
  String(clerkLocalization.signUp?.start?.subtitle || ""),
  /Google أو Apple أو Microsoft/
);
assert.equal(clerkLocalization.formButtonPrimary, "متابعة");
assert.ok(String(clerkAppearance.elements.dividerRow).includes("auth-clerk-hide-email-path"));
assert.ok(
  String(clerkAppearance.elements.formFieldRow__identifier).includes("auth-clerk-hide-email-path")
);
assert.match(
  String(clerkLocalization.unstable__errors?.form_username_invalid_length || ""),
  /اسم المستخدم/
);
assert.equal(clerkAppearance.layout.privacyPageUrl, "/privacy");
assert.equal(clerkAppearance.layout.termsPageUrl, "/terms");

console.log("test-clerk-config: OK");
