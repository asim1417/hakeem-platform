/**
 * لقطة استهلاك خفيفة لقائمة المستخدمين — بلا إثراء نشاط ثقيل.
 */
import { PRICING } from "@/config/pricing";
import { prisma } from "@/lib/prisma";

export type UserUsageSnapshot = {
  freeQuotaUsed: number;
  freeQuotaTotal: number;
  creditsBalance: number;
  subscriptionStatus: string;
  exhausted: boolean;
};

const EMPTY: UserUsageSnapshot = {
  freeQuotaUsed: 0,
  freeQuotaTotal: PRICING.freeQuota,
  creditsBalance: 0,
  subscriptionStatus: "free",
  exhausted: false,
};

/** يقرأ أعمدة الحصّة/النقاط لمجموعة مستخدمين. سقوط آمن إن غابت الأعمدة. */
export async function getUsersUsageSnapshots(
  userIds: string[]
): Promise<Map<string, UserUsageSnapshot>> {
  const map = new Map<string, UserUsageSnapshot>();
  if (!userIds.length) return map;

  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id,
              COALESCE("subscriptionStatus",'free') AS "subscriptionStatus",
              COALESCE("freeQuotaUsed",0)::int AS "freeQuotaUsed",
              COALESCE("freeQuotaTotal", $2)::int AS "freeQuotaTotal",
              COALESCE("creditsBalance",0)::int AS "creditsBalance"
         FROM "users"
        WHERE id = ANY($1::text[])`,
      userIds,
      PRICING.freeQuota
    )) as Array<{
      id: string;
      subscriptionStatus: string;
      freeQuotaUsed: number;
      freeQuotaTotal: number;
      creditsBalance: number;
    }>;

    for (const r of rows) {
      const total = r.freeQuotaTotal ?? PRICING.freeQuota;
      const used = r.freeQuotaUsed ?? 0;
      const sub = r.subscriptionStatus || "free";
      map.set(r.id, {
        freeQuotaUsed: used,
        freeQuotaTotal: total,
        creditsBalance: r.creditsBalance ?? 0,
        subscriptionStatus: sub,
        exhausted: sub !== "active" && used >= total,
      });
    }
  } catch {
    for (const id of userIds) map.set(id, { ...EMPTY });
  }

  return map;
}
