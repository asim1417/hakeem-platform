// ─────────────────────────────────────────────────────────────────────────────
// رموز الإحالة — توليد/استرداد فوق المصادقة الحالية.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "crypto";
import { awardCredits } from "@/lib/modules/credits/ledger";
import { updateProfile } from "@/lib/modules/onboarding/profile";

export function buildReferralCode(userId: string): string {
  const tail = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || randomBytes(4).toString("hex").toUpperCase();
  return `HKM-${tail}`;
}

export async function ensureReferralCode(userId: string): Promise<string | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const existing = await prisma.$queryRawUnsafe<{ referralCode: string | null }[]>(
      `SELECT "referralCode" FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    if (existing[0]?.referralCode) return existing[0].referralCode;

    let code = buildReferralCode(userId);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "users" SET "referralCode" = $2 WHERE id = $1 AND "referralCode" IS NULL`,
          userId,
          code
        );
        const again = await prisma.$queryRawUnsafe<{ referralCode: string | null }[]>(
          `SELECT "referralCode" FROM "users" WHERE id = $1 LIMIT 1`,
          userId
        );
        if (again[0]?.referralCode) return again[0].referralCode;
      } catch {
        code = `HKM-${randomBytes(4).toString("hex").toUpperCase()}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export interface ReferralInfo {
  code: string | null;
  link: string;
  shareText: string;
  unknown?: boolean;
}

export function buildReferralLink(code: string | null, origin = "https://hakeem-platform.vercel.app"): string {
  if (!code) return `${origin}/register`;
  return `${origin}/register?ref=${encodeURIComponent(code)}`;
}

export async function getReferralInfo(userId: string, origin?: string): Promise<ReferralInfo> {
  const code = await ensureReferralCode(userId);
  const link = buildReferralLink(code, origin);
  return {
    code,
    link,
    shareText: code
      ? `انضم إلى حكيم واحصل على 200 نقطة مجانية: ${link}`
      : `انضم إلى حكيم: ${link}`,
    unknown: !code,
  };
}

/**
 * استرداد رمز إحالة للمستخدم الحالي (مرة واحدة).
 * يمنح +300 للمُحيل و +200 للمُحال.
 */
export async function redeemReferral(
  refereeId: string,
  codeRaw: string
): Promise<{ ok: boolean; message: string; awarded?: number }> {
  const code = codeRaw.trim().toUpperCase();
  if (!code || !code.startsWith("HKM-")) {
    return { ok: false, message: "رمز الإحالة غير صالح." };
  }

  try {
    const { prisma } = await import("@/lib/prisma");

    const prior = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "referral_redemptions" WHERE "refereeId" = $1 LIMIT 1`,
      refereeId
    );
    if (prior[0]) return { ok: false, message: "استخدمت رمز إحالة مسبقًا." };

    const referrers = await prisma.$queryRawUnsafe<{ id: string; name: string }[]>(
      `SELECT id, name FROM "users" WHERE UPPER("referralCode") = $1 LIMIT 1`,
      code
    );
    const referrer = referrers[0];
    if (!referrer) return { ok: false, message: "رمز الإحالة غير موجود." };
    if (referrer.id === refereeId) return { ok: false, message: "لا يمكن استخدام رمزك الخاص." };

    const redId = `ref_${randomBytes(12).toString("hex")}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO "referral_redemptions" (id, "referrerId", "refereeId", code)
       VALUES ($1, $2, $3, $4)`,
      redId,
      referrer.id,
      refereeId,
      code
    );

    await updateProfile(refereeId, { referredBy: code });
    await awardCredits(referrer.id, "referral_signup");
    const received = await awardCredits(refereeId, "referral_received");

    return {
      ok: true,
      message: `حصلت على ${received.awarded || 200} نقطة من إحالة ${referrer.name}.`,
      awarded: received.awarded,
    };
  } catch {
    return { ok: false, message: "تعذّر استرداد رمز الإحالة — جرّب لاحقًا." };
  }
}
