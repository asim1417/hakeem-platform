/**
 * npx tsx scripts/test-auth-continue.ts
 */
import assert from "node:assert/strict";
import { needsOnboarding, type UserProfile } from "../lib/modules/onboarding/profile";

const incomplete = {
  unknown: false,
  onboardingCompleted: false,
  onboardingStep: 1,
} as UserProfile;

const complete = {
  unknown: false,
  onboardingCompleted: true,
  onboardingStep: 6,
} as UserProfile;

assert.equal(needsOnboarding(incomplete, "a@b.com"), true);
assert.equal(needsOnboarding(complete, "a@b.com"), false);
assert.equal(needsOnboarding(incomplete, "guest@hakeem.local"), false);

// سياسة المنتج: الدخول سلس — needsOnboarding للتذكير فقط وليس للإجبار
assert.equal(typeof needsOnboarding(incomplete), "boolean");

console.log("test-auth-continue: OK");
