// ─────────────────────────────────────────────────────────────────────────────
// تهيئة مستخدم جديد: onboarding + نقاط + إحالة + بريد ترحيب.
// ─────────────────────────────────────────────────────────────────────────────
import { CREDIT_REWARDS } from "@/config/credits";
import { awardSignupBundle } from "@/lib/modules/credits/ledger";
import { sendWelcomeEmail } from "@/lib/modules/email/send";
import { markOnboardingPending } from "@/lib/modules/onboarding/profile";
import { ensureReferralCode, redeemReferral } from "@/lib/modules/referrals/codes";
import { prisma } from "@/lib/prisma";

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

  const user = await prisma.user
    .findUnique({ where: { id: userId }, select: { email: true, name: true } })
    .catch(() => null);
  if (user?.email) {
    await sendWelcomeEmail({
      to: user.email,
      name: user.name,
      credits: CREDIT_REWARDS.welcome + CREDIT_REWARDS.signup,
    }).catch(() => undefined);
  }
}
