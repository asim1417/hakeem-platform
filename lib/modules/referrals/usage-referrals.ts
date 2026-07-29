import "server-only";

import { grantUsageReward } from "@/lib/modules/credits/usage-ledger";

/**
 * الإحالة لا تتأهل بمجرد التسجيل: يلزم توثيق الجوال، إكمال الملف،
 * ثم أول استخدام ناجح أو أول مستند جاهز/مفهرس.
 */
export async function evaluateUsageReferral(refereeId: string): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const candidates = await prisma.$queryRawUnsafe<
      { id: string; referrerId: string; phoneVerified: boolean; onboardingCompleted: boolean }[]
    >(
      `SELECT r.id, r."referrerId", u."phoneVerified", u."onboardingCompleted"
         FROM "referral_redemptions" r
         JOIN "users" u ON u.id = r."refereeId"
        WHERE r."refereeId" = $1 AND r.status = 'pending'
        LIMIT 1`,
      refereeId
    );
    const referral = candidates[0];
    if (!referral?.phoneVerified || !referral.onboardingCompleted) return false;

    const activity = await prisma.$queryRawUnsafe<{ happenedAt: Date }[]>(
      `SELECT "createdAt" AS "happenedAt"
         FROM "usage_credit_ledger"
        WHERE "userId" = $1 AND "entryType" = 'debit'
       UNION ALL
       SELECT "createdAt" AS "happenedAt"
         FROM "attachments"
        WHERE "processingStatus" = 'READY' AND metadata->>'uploadedBy' = $1
       ORDER BY "happenedAt" ASC LIMIT 1`,
      refereeId
    );
    if (!activity[0]) return false;

    const updated = await prisma.$queryRawUnsafe<{ id: string; referrerId: string }[]>(
      `UPDATE "referral_redemptions"
          SET status = 'qualified',
              "verifiedAt" = NOW(),
              "profileCompletedAt" = NOW(),
              "firstUseAt" = $2,
              "qualifiedAt" = NOW()
        WHERE id = $1 AND status = 'pending'
        RETURNING id, "referrerId"`,
      referral.id,
      activity[0].happenedAt
    );
    if (!updated[0]) return false;

    await grantUsageReward({
      userId: refereeId,
      rewardCode: "referral_invitee_qualified",
      sourceId: referral.id,
    });
    await grantUsageReward({
      userId: referral.referrerId,
      rewardCode: "referral_inviter_qualified",
      sourceId: referral.id,
    });
    return true;
  } catch {
    return false;
  }
}

/** يُستدعى من webhook دفع موثّق ومكرّر الحماية فقط. */
export async function recordReferralFirstPurchase(
  refereeId: string,
  paymentId: string
): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ id: string; referrerId: string }[]>(
      `UPDATE "referral_redemptions"
          SET status = 'purchased', "firstPurchaseAt" = NOW()
        WHERE "refereeId" = $1 AND status = 'qualified' AND "firstPurchaseAt" IS NULL
        RETURNING id, "referrerId"`,
      refereeId
    );
    const referral = rows[0];
    if (!referral) return false;
    await grantUsageReward({
      userId: referral.referrerId,
      rewardCode: "referral_inviter_first_purchase",
      // المكافأة مرة لكل إحالة، لا مرة لكل إعادة إرسال للـwebhook.
      sourceId: referral.id,
    });
    void paymentId;
    return true;
  } catch {
    return false;
  }
}
