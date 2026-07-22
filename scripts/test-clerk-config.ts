/**
 * اختبار إعداد Clerk — بلا شبكة.
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
assert.ok(clerkAppearance.elements.formButtonPrimary.includes("#0E3435"));
assert.equal(clerkLocalization.locale, "ar-SA");
assert.equal(clerkLocalization.signIn?.start?.title, "تسجيل الدخول إلى حكيم");
assert.equal(clerkLocalization.signUp?.start?.title, "إنشاء حساب في حكيم");

console.log("test-clerk-config: OK");
