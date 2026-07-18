/**
 * اختبار كتالوج النقاط ومنطق الإحالة/الملف — بلا شبكة.
 * التشغيل: npx tsx scripts/test-credits-onboarding.ts
 */
import assert from "node:assert/strict";
import { CREDIT_REWARDS, CREDIT_USES, onboardingStepsTotal } from "../config/credits";
import { buildReferralCode, buildReferralLink } from "../lib/modules/referrals/codes";
import { needsOnboarding, type UserProfile } from "../lib/modules/onboarding/profile";

assert.equal(CREDIT_REWARDS.welcome, 500);
assert.equal(CREDIT_REWARDS.signup, 100);
assert.equal(CREDIT_REWARDS.referral_signup, 300);
assert.equal(CREDIT_REWARDS.referral_received, 200);
assert.ok(onboardingStepsTotal() >= 725);
assert.ok(CREDIT_USES.length >= 3);

const code = buildReferralCode("clxyz1234567890abcdef");
assert.ok(code.startsWith("HKM-"));
assert.ok(buildReferralLink(code).includes(`ref=${encodeURIComponent(code)}`));
assert.ok(buildReferralLink(null).endsWith("/register"));

const base: UserProfile = {
  phone: null,
  city: null,
  entityType: null,
  yearsExperience: null,
  specialties: [],
  interests: [],
  alertsEnabled: false,
  phoneVerified: false,
  termsAccepted: false,
  onboardingCompleted: false,
  onboardingStep: 0,
  referralCode: null,
  referredBy: null,
  creditsBalance: 0,
};
assert.equal(needsOnboarding(base), true);
assert.equal(needsOnboarding({ ...base, onboardingCompleted: true }), false);
assert.equal(needsOnboarding({ ...base, unknown: true }), false);
assert.equal(needsOnboarding(base, "guest@hakeem.local"), false);

console.log("test-credits-onboarding: OK");
