import "server-only";

// تجديد الاشتراكات — HKM-BILLING-UX-001 (§8). يُشغَّل دوريًا (billing-cron).
// دفع ناجح → نقاط الدورة الجديدة. فشل → PAYMENT_RETRY + إشعار. إلغاء → EXPIRED + مجاني.
// تطبيق التخفيض المؤجّل (pendingPlanId) عند التجديد. لا حذف ملفات المستخدم.

import { createSubscriptionOrder } from "@/lib/modules/billing/orders";
import { fulfillPaidOrder } from "@/lib/modules/billing/fulfillment";
import { getPaymentProvider } from "@/lib/payments/payment-provider";
import { notify } from "@/lib/modules/billing/notifications";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

function autoRenewalEnabled(): boolean {
  return /^(1|true|on)$/i.test(process.env.AUTO_RENEWAL_ENABLED || "");
}

export interface RenewalReport {
  processed: number;
  renewed: number;
  retried: number;
  expired: number;
  upcomingNotified: number;
}

export async function runRenewals(now: Date = new Date()): Promise<RenewalReport> {
  const { prisma } = await import("@/lib/prisma");
  const report: RenewalReport = { processed: 0, renewed: 0, retried: 0, expired: 0, upcomingNotified: 0 };

  // (أ) تذكير قرب التجديد (خلال 3 أيام) — إشعار مُزال التكرار.
  try {
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 3);
    const upcoming = await prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: { gt: now, lte: soon },
      },
      select: { userId: true, currentPeriodEnd: true },
    });
    for (const s of upcoming) {
      if (!s.userId) continue;
      await notify({
        userId: s.userId,
        event: "renewal_upcoming",
        data: { date: s.currentPeriodEnd?.toISOString().slice(0, 10) },
        dedupeKey: `renewal_upcoming:${s.userId}:${s.currentPeriodEnd?.toISOString().slice(0, 10)}`,
        email: true,
      });
      report.upcomingNotified++;
    }
  } catch {
    /* */
  }

  // (ب) الاشتراكات المستحقّة (انتهت الدورة).
  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "PAYMENT_RETRY"] },
      currentPeriodEnd: { lte: now },
    },
    take: 500,
  });

  for (const sub of due) {
    report.processed++;
    if (!sub.userId) continue;

    // إلغاء → انتهاء + تحويل للمجانية (بلا حذف ملفات).
    if (sub.cancelAtPeriodEnd) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
      await prisma.$executeRawUnsafe(`UPDATE "users" SET "subscriptionStatus" = 'free' WHERE id = $1`, sub.userId).catch(() => undefined);
      await notify({ userId: sub.userId, event: "subscription_canceled", data: { periodEnd: sub.currentPeriodEnd?.toISOString().slice(0, 10) }, dedupeKey: `sub_expired:${sub.id}` });
      report.expired++;
      continue;
    }

    // تطبيق التخفيض المؤجّل.
    let planCode: string | null = null;
    let period: "MONTHLY" | "YEARLY" = (sub.pendingPeriod as "MONTHLY" | "YEARLY") || "MONTHLY";
    if (sub.pendingPlanId) {
      const pendingPlan = await prisma.plan.findUnique({ where: { id: sub.pendingPlanId } });
      if (pendingPlan) {
        planCode = pendingPlan.code;
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { planId: sub.pendingPlanId, pendingPlanId: null, pendingPeriod: null },
        });
      }
    }
    if (!planCode) {
      const plan = await prisma.plan.findUnique({ where: { id: sub.planId } });
      planCode = plan?.code ?? null;
    }
    if (!planCode) continue;

    // إنشاء طلب تجديد.
    const orderRes = await createSubscriptionOrder({
      userId: sub.userId,
      planCode,
      period,
      type: "SUBSCRIPTION_RENEWAL",
      idempotencyKey: `renew:${sub.id}:${sub.currentPeriodEnd?.toISOString().slice(0, 10)}`,
    });
    if (!orderRes.ok || !orderRes.order) {
      report.retried++;
      continue;
    }
    const order = orderRes.order;

    // محاولة الدفع التلقائي عبر وسيلة مرمّزة (إن فُعّل ووُجدت).
    const pm = await prisma.paymentMethod.findFirst({
      where: { userId: sub.userId, isDefault: true, status: "ACTIVE", providerToken: { not: null } },
    });

    let charged = false;
    if (autoRenewalEnabled() && pm?.providerToken) {
      const provider = await getPaymentProvider();
      const result = await provider.chargeSavedPaymentMethod({
        orderId: order.id,
        amountHalalas: order.totalHalalas,
        currency: order.currency,
        descriptionAr: `تجديد اشتراك حكيم — ${planCode}`,
        providerToken: pm.providerToken,
        callbackUrl: process.env.PAYMENT_WEBHOOK_URL || "",
        metadata: { orderId: order.id },
      });
      if (result.ok && result.payment?.status === "paid") {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            provider: provider.name,
            providerPaymentId: result.payment.id,
            status: "PAID",
            amountHalalas: order.totalHalalas,
            currency: order.currency,
            paidAt: now,
          },
        }).catch(() => undefined);
        await fulfillPaidOrder({ orderId: order.id, providerPaymentId: result.payment.id });
        charged = true;
      }
    }

    if (charged) {
      await notify({ userId: sub.userId, event: "renewal_succeeded", dedupeKey: `renew_ok:${order.id}` });
      report.renewed++;
    } else {
      // فشل/تعذّر الدفع التلقائي → إعادة المحاولة + إشعار (رابط دفع يدوي).
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "PAYMENT_RETRY" } });
      await notify({ userId: sub.userId, event: "payment_failed", dedupeKey: `pay_fail:${order.id}`, email: true });
      await recordBillingAudit({
        action: "RENEWAL_PAYMENT_RETRY",
        actorUserId: sub.userId,
        targetType: "subscription",
        targetId: sub.id,
        metadata: { orderId: order.id },
      });
      report.retried++;
    }
  }

  return report;
}
