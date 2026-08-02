import "server-only";

// بدء الدفع — HKM-BILLING-UX-001 (§8). المبالغ خادمية؛ العميل لا يمرّر مبلغًا/نقاطًا.
// خلف علمَي BILLING_ENABLED + PAID_CHECKOUT_ENABLED.

import { randomBytes } from "crypto";
import { createPackageOrder, createSubscriptionOrder, type OrderRecord } from "@/lib/modules/billing/orders";
import { getPaymentProvider } from "@/lib/payments/payment-provider";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

export function paidCheckoutEnabled(): boolean {
  return (
    /^(1|true|on)$/i.test(process.env.BILLING_ENABLED || "") &&
    /^(1|true|on)$/i.test(process.env.PAID_CHECKOUT_ENABLED || "")
  );
}

export interface StartCheckoutInput {
  userId: string;
  userEmail?: string;
  userName?: string;
  origin: string;
  type: "SUBSCRIPTION" | "PACKAGE";
  planCode?: string;
  period?: "MONTHLY" | "YEARLY";
  packageCode?: string;
}

export interface StartCheckoutResult {
  ok: boolean;
  url?: string;
  orderId?: string;
  message?: string;
}

export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  if (!paidCheckoutEnabled()) {
    return { ok: false, message: "الدفع غير مفعّل حاليًا." };
  }
  // 1) إنشاء الطلب (مبالغ خادمية موثوقة).
  let order: OrderRecord | undefined;
  if (input.type === "SUBSCRIPTION") {
    if (!input.planCode || !input.period) return { ok: false, message: "بيانات الباقة ناقصة." };
    const r = await createSubscriptionOrder({
      userId: input.userId,
      planCode: input.planCode,
      period: input.period,
    });
    if (!r.ok || !r.order) return { ok: false, message: r.message };
    order = r.order;
  } else {
    if (!input.packageCode) return { ok: false, message: "بيانات الحزمة ناقصة." };
    const r = await createPackageOrder({ userId: input.userId, packageCode: input.packageCode });
    if (!r.ok || !r.order) return { ok: false, message: r.message };
    order = r.order;
  }

  // 2) تسجيل محاولة دفع (INITIATED).
  const { prisma } = await import("@/lib/prisma");
  const provider = await getPaymentProvider();
  const paymentId = `pay_${randomBytes(12).toString("hex")}`;
  await prisma.payment.create({
    data: {
      id: paymentId,
      orderId: order.id,
      provider: provider.name,
      status: "INITIATED",
      amountHalalas: order.totalHalalas,
      currency: order.currency,
    },
  });

  // 3) إنشاء checkout لدى المزوّد (المبلغ من الطلب فقط).
  const callbackUrl = process.env.PAYMENT_WEBHOOK_URL || `${input.origin}/api/billing/webhooks/moyasar`;
  const checkout = await provider.createCheckout({
    orderId: order.id,
    amountHalalas: order.totalHalalas,
    currency: order.currency,
    descriptionAr:
      order.type === "POINTS_PACKAGE"
        ? `شراء ${order.pointsGranted ?? ""} نقطة — حكيم`
        : `اشتراك حكيم — ${input.planCode} (${input.period})`,
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    callbackUrl,
    successUrl: `${input.origin}/dashboard/account/billing?checkout=success&order=${order.id}`,
    backUrl: `${input.origin}/dashboard/account/billing?checkout=cancel`,
    metadata: { orderId: order.id, userId: input.userId },
  });

  if (!checkout.ok || !checkout.url) {
    await prisma.order.update({ where: { id: order.id }, data: { status: "FAILED" } }).catch(() => undefined);
    return { ok: false, message: checkout.message || "تعذّر بدء الدفع." };
  }

  if (checkout.providerRef) {
    await prisma.payment
      .update({ where: { id: paymentId }, data: { providerPaymentId: checkout.providerRef, status: "PENDING" } })
      .catch(() => undefined);
  }

  await recordBillingAudit({
    action: "CHECKOUT_STARTED",
    actorUserId: input.userId,
    targetType: "order",
    targetId: order.id,
    metadata: { type: input.type, totalHalalas: order.totalHalalas },
  });

  return { ok: true, url: checkout.url, orderId: order.id };
}
