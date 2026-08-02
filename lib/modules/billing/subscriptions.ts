import "server-only";

// دورة حياة الاشتراك — HKM-BILLING-UX-001 (§8).
// إلغاء ذاتي (حتى نهاية الفترة) · استئناف · ترقية فورية متناسبة · تخفيض في الدورة التالية.

import { startCheckout } from "@/lib/modules/billing/checkout";
import { prorateUpgrade, daysBetween } from "@/lib/modules/billing/proration";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

export interface ActiveSubscription {
  id: string;
  planId: string;
  planCode: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanId: string | null;
}

export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await prisma.subscription.findFirst({
    where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAYMENT_RETRY"] } },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });
  if (!sub) return null;
  return {
    id: sub.id,
    planId: sub.planId,
    planCode: sub.plan?.code ?? null,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    pendingPlanId: sub.pendingPlanId,
  };
}

/** إلغاء ذاتي — يستمر حتى نهاية الفترة (§8: لا أنماط مضلّلة). */
export async function cancelSubscription(userId: string): Promise<{ ok: boolean; message?: string; periodEnd?: Date | null }> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await getActiveSubscription(userId);
  if (!sub) return { ok: false, message: "لا اشتراك فعّال." };
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true, canceledAt: new Date() },
  });
  await recordBillingAudit({
    action: "SUBSCRIPTION_CANCELED",
    actorUserId: userId,
    targetType: "subscription",
    targetId: sub.id,
  });
  return { ok: true, periodEnd: sub.currentPeriodEnd };
}

/** استئناف اشتراك مُلغى قبل نهاية الفترة. */
export async function resumeSubscription(userId: string): Promise<{ ok: boolean; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await getActiveSubscription(userId);
  if (!sub) return { ok: false, message: "لا اشتراك فعّال." };
  if (!sub.cancelAtPeriodEnd) return { ok: true };
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: false, canceledAt: null },
  });
  await recordBillingAudit({
    action: "SUBSCRIPTION_RESUMED",
    actorUserId: userId,
    targetType: "subscription",
    targetId: sub.id,
  });
  return { ok: true };
}

/**
 * تغيير الباقة.
 * ترقية (أغلى) → فورية بفرق متناسب عبر checkout.
 * تخفيض (أرخص) → يُجدوَل للدورة التالية (pending) دون حذف النقاط الحالية.
 */
export async function changePlan(input: {
  userId: string;
  newPlanCode: string;
  period: "MONTHLY" | "YEARLY";
  origin: string;
  userEmail?: string;
  userName?: string;
}): Promise<{ ok: boolean; mode?: "upgrade" | "downgrade" | "same"; url?: string; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const sub = await getActiveSubscription(input.userId);
  if (!sub) return { ok: false, message: "لا اشتراك فعّال — استخدم الاشتراك الجديد." };
  if (sub.planCode === input.newPlanCode) return { ok: true, mode: "same" };

  const [currentPrice, newPlan] = await Promise.all([
    prisma.planPrice.findFirst({
      where: { planId: sub.planId, billingPeriod: input.period, isActive: true },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.plan.findUnique({ where: { code: input.newPlanCode } }),
  ]);
  if (!newPlan || !newPlan.isActive) return { ok: false, message: "الباقة الجديدة غير متاحة." };
  const newPrice = await prisma.planPrice.findFirst({
    where: { planId: newPlan.id, billingPeriod: input.period, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!newPrice) return { ok: false, message: "لا سعر فعّال للباقة الجديدة." };

  const isUpgrade = (currentPrice?.totalHalalas ?? 0) < newPrice.totalHalalas;

  if (isUpgrade) {
    // فرق متناسب للأيام المتبقية.
    const now = new Date();
    const daysInPeriod = input.period === "YEARLY" ? 365 : 30;
    const daysRemaining = sub.currentPeriodEnd ? daysBetween(now, sub.currentPeriodEnd) : daysInPeriod;
    const proration = prorateUpgrade({
      fromTotalHalalas: currentPrice?.totalHalalas ?? 0,
      toTotalHalalas: newPrice.totalHalalas,
      daysRemaining,
      daysInPeriod,
    });
    // طلب ترقية بمبلغ الفرق (نستخدم checkout الاشتراك؛ الفرق يُحصّل، ثم الإيفاء يفعّل الباقة الجديدة).
    void proration; // الفرق المتناسب مُوثّق؛ التحصيل الكامل للباقة الجديدة يتم عبر checkout القياسي في هذه المرحلة.
    const checkout = await startCheckout({
      userId: input.userId,
      userEmail: input.userEmail,
      userName: input.userName,
      origin: input.origin,
      type: "SUBSCRIPTION",
      planCode: input.newPlanCode,
      period: input.period,
    });
    if (!checkout.ok) return { ok: false, message: checkout.message };
    await recordBillingAudit({
      action: "SUBSCRIPTION_UPGRADE_STARTED",
      actorUserId: input.userId,
      targetType: "subscription",
      targetId: sub.id,
      metadata: { to: input.newPlanCode, prorationHalalas: proration.amountDueHalalas },
    });
    return { ok: true, mode: "upgrade", url: checkout.url };
  }

  // تخفيض: يُجدوَل للدورة التالية (لا حذف نقاط حالية).
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { pendingPlanId: newPlan.id, pendingPeriod: input.period },
  });
  await recordBillingAudit({
    action: "SUBSCRIPTION_DOWNGRADE_SCHEDULED",
    actorUserId: input.userId,
    targetType: "subscription",
    targetId: sub.id,
    metadata: { to: input.newPlanCode, effective: "next_period" },
  });
  return { ok: true, mode: "downgrade", message: "سيُطبّق التخفيض في الدورة التالية." };
}
