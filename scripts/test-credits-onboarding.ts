/**
 * اختبار كتالوج النقاط والصرف والإحالة — بلا شبكة.
 * التشغيل: npx tsx scripts/test-credits-onboarding.ts
 */
import assert from "node:assert/strict";
import {
  CREDIT_REWARDS,
  CREDIT_SPENDS,
  CREDIT_USES,
  onboardingStepsTotal,
} from "../config/credits";
import { buildReferralCode, buildReferralLink } from "../lib/modules/referrals/codes";
import { needsOnboarding, type UserProfile } from "../lib/modules/onboarding/profile";
import { formatSar, getPlan, getPlans, isCheckoutLive } from "../config/pricing";
import { isEmailConfigured } from "../lib/modules/email/send";
import { isSmsConfigured, shouldRevealOtp } from "../lib/modules/otp/phone-otp";
import { isMoyasarLive } from "../lib/modules/billing/moyasar";

assert.equal(CREDIT_REWARDS.welcome, 500);
assert.equal(CREDIT_REWARDS.signup, 100);
assert.equal(CREDIT_REWARDS.daily_visit, 25);
assert.equal(CREDIT_REWARDS.read_article, 10);
assert.equal(CREDIT_REWARDS.save_ruling, 5);
assert.equal(CREDIT_SPENDS.download_ruling.points, 50);
assert.equal(CREDIT_SPENDS.advanced_use.points, 25);
assert.ok(onboardingStepsTotal() >= 775);
assert.ok(CREDIT_USES.length >= 5);

const code = buildReferralCode("clxyz1234567890abcdef");
assert.ok(code.startsWith("HKM-"));
assert.ok(buildReferralLink(code).includes(`ref=${encodeURIComponent(code)}`));

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
  avatarUrl: null,
  certificates: [],
};
assert.equal(needsOnboarding(base), true);
assert.equal(needsOnboarding({ ...base, onboardingCompleted: true }), false);
assert.equal(needsOnboarding(base, "guest@hakeem.local"), false);

assert.ok(getPlans().length >= 3);
assert.ok(getPlan("pro"));
assert.equal(formatSar(null), "مجاني");
assert.equal(typeof isCheckoutLive(), "boolean");
assert.equal(typeof isMoyasarLive(), "boolean");
assert.equal(typeof isEmailConfigured(), "boolean");
assert.equal(typeof isSmsConfigured(), "boolean");
assert.equal(typeof shouldRevealOtp(), "boolean");

console.log("test-credits-onboarding: OK");
