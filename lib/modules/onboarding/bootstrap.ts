// ─────────────────────────────────────────────────────────────────────────────
// تهيئة مستخدم جديد: onboarding معلّق + نقاط ترحيب + رمز إحالة + استرداد ref.
// يُستدعى من التسجيل وكلمة المرور وOAuth — دون كسر المسارات القائمة.
// ─────────────────────────────────────────────────────────────────────────────
import { awardSignupBundle } from "@/lib/modules/credits/ledger";
import { markOnboardingPending } from "@/lib/modules/onboarding/profile";
import { ensureReferralCode, redeemReferral } from "@/lib/modules/referrals/codes";

export async function bootstrapNewUser(
  userId: string,
  opts?: { referralCode?: string | null; skipOnboarding?: boolean }
): Promise<void> {
  if (!opts?.skipOnboarding) {
    await markOnboardingPending(userId);
  }
  await ensureReferralCode(userId);
  await awardSignupBundle(userId);

  const ref = opts?.referralCode?.trim();
  if (ref) {
    await redeemReferral(userId, ref).catch(() => undefined);
  }
}
