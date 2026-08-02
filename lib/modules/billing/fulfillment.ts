import "server-only";

// إيفاء الطلب بعد تأكّد الدفع من البوابة — HKM-BILLING-UX-001 (§8).
// idempotent: لا منح مزدوج، لا تفعيل مزدوج. يُستدعى فقط بعد verifyPayment الخادمي.

import { grantCredits } from "@/lib/modules/billing/credit-engine";
import { issueInvoiceForOrder } from "@/lib/modules/billing/invoicing";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * إيفاء طلب مدفوع: منح النقاط/تفعيل الاشتراك + إصدار فاتورة.
 * idempotent عبر حالة الطلب (PAID) ومفاتيح idempotency للمنح.
 */
export async function fulfillPaidOrder(input: {
  orderId: string;
  providerPaymentId?: string;
  paymentMethodType?: string;
}): Promise<{ ok: boolean; alreadyFulfilled?: boolean; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const order = await prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order) return { ok: false, message: "الطلب غير موجود." };
  if (order.status === "PAID" || order.status === "REFUNDED") {
    return { ok: true, alreadyFulfilled: true };
  }

  // 1) تحديث حالة الطلب إلى PAID (ذرّي بشرط الحالة لمنع الازدواج).
  const updated = await prisma.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING", "AWAITING_PAYMENT", "FAILED"] } },
    data: { status: "PAID" },
  });
  if (updated.count === 0) {
    return { ok: true, alreadyFulfilled: true };
  }

  const now = new Date();

  // 2) منح النقاط حسب نوع الطلب.
  if (order.type === "POINTS_PACKAGE" && order.pointsGranted) {
    await grantCredits({
      userId: order.userId,
      points: order.pointsGranted,
      sourceType: "PURCHASE",
      sourceReferenceId: order.id,
      idempotencyKey: `order:${order.id}:grant`,
      description: `شراء حزمة ${order.pointsPackageCode ?? ""}`.trim(),
    });
  } else if (order.type.startsWith("SUBSCRIPTION") && order.planId) {
    // تفعيل/تجديد الاشتراك: دورة شهرية (أو سنوية عبر metadata).
    const meta = (order.metadata as { period?: string } | null) || {};
    const isYearly = meta.period === "YEARLY";
    const periodEnd = addMonths(now, isYearly ? 12 : 1);

    // اشتراك واحد فعّال لكل مستخدم (تبسيط المرحلة الحالية).
    const existing = await prisma.subscription.findFirst({
      where: { userId: order.userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAYMENT_RETRY"] } },
      orderBy: { createdAt: "desc" },
    });
    let subscriptionId: string;
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: order.planId,
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });
      subscriptionId = existing.id;
    } else {
      const sub = await prisma.subscription.create({
        data: {
          userId: order.userId,
          planId: order.planId,
          provider: "moyasar",
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      subscriptionId = sub.id;
    }
    await prisma.order.update({ where: { id: order.id }, data: { subscriptionId } });

    if (order.pointsGranted) {
      // نقاط الاشتراك تنتهي بنهاية الدورة (§5). idempotency لكل دورة.
      await grantCredits({
        userId: order.userId,
        points: order.pointsGranted,
        sourceType: "SUBSCRIPTION",
        sourceReferenceId: subscriptionId,
        expiresAt: periodEnd,
        priority: 90,
        idempotencyKey: `sub:${subscriptionId}:${now.toISOString().slice(0, 10)}:${order.id}`,
        description: "نقاط اشتراك شهرية",
      });
    }
    // توافق خلفي: علم الاشتراك القديم على users (لا يكسر منطق الحصّة).
    await prisma.$executeRawUnsafe(
      `UPDATE "users" SET "subscriptionStatus" = 'active' WHERE id = $1`,
      order.userId
    ).catch(() => undefined);
  }

  // 3) تسجيل الدفعة (إن مُرِّرت) — best-effort.
  if (input.providerPaymentId) {
    await prisma.payment.updateMany({
      where: { orderId: order.id, providerPaymentId: input.providerPaymentId },
      data: { status: "PAID", paidAt: now, paymentMethodType: input.paymentMethodType ?? null },
    }).catch(() => undefined);
  }

  // 4) إصدار الفاتورة (idempotent عبر order_id).
  try {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
    // نوع الفاتورة حسب المشتري (ZATCA): منشأة مسجّلة بالضريبة → فاتورة ضريبية؛ فرد → مبسّطة.
    let entityType: string | null = null;
    try {
      const rows = await prisma.$queryRawUnsafe<{ entityType: string | null }[]>(
        `SELECT "entityType" FROM "users" WHERE id = $1 LIMIT 1`,
        order.userId
      );
      entityType = rows[0]?.entityType ?? null;
    } catch {
      /* عمود اختياري */
    }
    const isBusiness = entityType != null && ["LAW_FIRM", "COMPANY", "GOVERNMENT"].includes(entityType);
    await issueInvoiceForOrder({
      orderId: order.id,
      userId: order.userId,
      currency: order.currency,
      subtotalHalalas: order.subtotalHalalas,
      vatRateBps: order.subtotalHalalas > 0 ? Math.round((order.vatHalalas * 10000) / order.subtotalHalalas) : 1500,
      vatHalalas: order.vatHalalas,
      totalHalalas: order.totalHalalas,
      type: isBusiness ? "TAX_INVOICE" : "SIMPLIFIED_TAX_INVOICE",
      buyer: { nameAr: user?.name, email: user?.email },
      issuedYear: now.getUTCFullYear(),
    });
  } catch {
    /* لا نُفشل الإيفاء إن تعذّر إصدار الفاتورة — يُعاد لاحقًا عبر المصالحة */
  }

  await recordBillingAudit({
    action: "ORDER_FULFILLED",
    targetType: "order",
    targetId: order.id,
    metadata: { type: order.type, points: order.pointsGranted },
  });

  return { ok: true };
}
