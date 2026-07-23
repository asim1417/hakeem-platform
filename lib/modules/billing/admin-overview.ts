/**
 * نظرة فوترة للسوبر أدمن — تجميعات خام فوق أعمدة الحصّة/الاشتراك/النقاط.
 * سقوط آمن قبل الهجرة أو عند غياب الأعمدة.
 */
import { PRICING, PLANS } from "@/config/pricing";
import { isMoyasarLive } from "@/lib/modules/billing/moyasar";
import { prisma } from "@/lib/prisma";

export type BillingAdminOverview = {
  moyasarLive: boolean;
  freeQuotaDefault: number;
  currency: string;
  plans: Array<{ id: string; nameAr: string; monthlySar: number | null; yearlySar: number | null }>;
  counts: {
    usersTotal: number;
    subscribedActive: number;
    freeOrUnknown: number;
    quotaExhausted: number;
  };
  credits: {
    totalBalance: number;
    recentTx: Array<{
      id: string;
      userId: string;
      amount: number;
      source: string;
      createdAt: string;
      email?: string | null;
    }>;
  };
  topQuotaUsers: Array<{
    id: string;
    email: string | null;
    name: string | null;
    subscriptionStatus: string | null;
    freeQuotaUsed: number;
    freeQuotaTotal: number | null;
  }>;
};

const EMPTY: BillingAdminOverview = {
  moyasarLive: false,
  freeQuotaDefault: PRICING.freeQuota,
  currency: PRICING.currency,
  plans: PLANS.map((p) => ({
    id: p.id,
    nameAr: p.nameAr,
    monthlySar: p.monthlySar,
    yearlySar: p.yearlySar,
  })),
  counts: { usersTotal: 0, subscribedActive: 0, freeOrUnknown: 0, quotaExhausted: 0 },
  credits: { totalBalance: 0, recentTx: [] },
  topQuotaUsers: [],
};

export async function getBillingAdminOverview(): Promise<BillingAdminOverview> {
  const out: BillingAdminOverview = {
    ...EMPTY,
    moyasarLive: isMoyasarLive(),
    freeQuotaDefault: PRICING.freeQuota,
    plans: PLANS.map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      monthlySar: p.monthlySar,
      yearlySar: p.yearlySar,
    })),
    counts: { ...EMPTY.counts },
    credits: { totalBalance: 0, recentTx: [] },
    topQuotaUsers: [],
  };

  try {
    out.counts.usersTotal = await prisma.user.count();
  } catch {
    return out;
  }

  try {
    const statusRows = (await prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE("subscriptionStatus",'free') = 'active')::int AS active,
         COUNT(*) FILTER (WHERE COALESCE("subscriptionStatus",'free') <> 'active')::int AS freeish,
         COUNT(*) FILTER (
           WHERE COALESCE("subscriptionStatus",'free') <> 'active'
             AND COALESCE("freeQuotaUsed",0) >= COALESCE("freeQuotaTotal", $1)
         )::int AS exhausted
       FROM "users"`,
      PRICING.freeQuota
    )) as Array<{ active: number; freeish: number; exhausted: number }>;
    if (statusRows[0]) {
      out.counts.subscribedActive = statusRows[0].active;
      out.counts.freeOrUnknown = statusRows[0].freeish;
      out.counts.quotaExhausted = statusRows[0].exhausted;
    }
  } catch {
    /* أعمدة الحصّة غير موجودة بعد */
  }

  try {
    const bal = (await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM("creditsBalance"),0)::int AS total FROM "users"`
    )) as Array<{ total: number }>;
    out.credits.totalBalance = bal[0]?.total ?? 0;
  } catch {
    /* */
  }

  try {
    const tx = (await prisma.$queryRawUnsafe(
      `SELECT t.id, t."userId", t.amount, t.source, t."createdAt", u.email
         FROM "credit_transactions" t
         LEFT JOIN "users" u ON u.id = t."userId"
        ORDER BY t."createdAt" DESC
        LIMIT 20`
    )) as Array<{
      id: string;
      userId: string;
      amount: number;
      source: string;
      createdAt: Date;
      email: string | null;
    }>;
    out.credits.recentTx = tx.map((r) => ({
      id: r.id,
      userId: r.userId,
      amount: r.amount,
      source: r.source,
      createdAt: new Date(r.createdAt).toISOString(),
      email: r.email,
    }));
  } catch {
    /* */
  }

  try {
    const top = (await prisma.$queryRawUnsafe(
      `SELECT id, email, name, "subscriptionStatus",
              COALESCE("freeQuotaUsed",0)::int AS "freeQuotaUsed",
              "freeQuotaTotal"
         FROM "users"
        WHERE COALESCE("subscriptionStatus",'free') <> 'active'
        ORDER BY COALESCE("freeQuotaUsed",0) DESC
        LIMIT 15`
    )) as Array<{
      id: string;
      email: string | null;
      name: string | null;
      subscriptionStatus: string | null;
      freeQuotaUsed: number;
      freeQuotaTotal: number | null;
    }>;
    out.topQuotaUsers = top;
  } catch {
    /* */
  }

  return out;
}

/** منح/إلغاء اشتراك يدوي من السوبر أدمن (SQL خام، سقوط آمن). */
export async function setUserSubscriptionStatus(
  userId: string,
  status: "active" | "free"
): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET "subscriptionStatus" = $2 WHERE id = $1`,
      userId,
      status
    );
    return true;
  } catch {
    return false;
  }
}

/** إعادة ضبط الحصّة المجانية لمستخدم. */
export async function resetUserFreeQuota(userId: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "users"
          SET "freeQuotaUsed" = 0,
              "freeQuotaTotal" = COALESCE("freeQuotaTotal", $2)
        WHERE id = $1`,
      userId,
      PRICING.freeQuota
    );
    return true;
  } catch {
    return false;
  }
}
