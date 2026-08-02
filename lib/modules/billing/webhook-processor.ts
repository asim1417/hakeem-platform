import "server-only";

// معالجة webhook الدفع المُقوّاة — HKM-BILLING-UX-001 (§7).
// (1) تحقق توقيع/سرّ  (2) تسجيل خام قبل المعالجة  (3) منع التكرار (unique)
// (4) إعادة تحقق من البوابة (مصدر الحقيقة)  (5) مطابقة المبلغ/العملة  (6) إيفاء idempotent.
// لا منح نقاط قبل تأكّد الدفع خادميًا. العميل لا يمكنه تغيير المبلغ/النقاط.

import { getPaymentProvider } from "@/lib/payments/payment-provider";
import { fulfillPaidOrder } from "@/lib/modules/billing/fulfillment";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

export interface WebhookOutcome {
  http: number;
  status: "processed" | "duplicate" | "rejected" | "ignored" | "mismatch" | "unverified";
  detail?: string;
}

export async function processPaymentWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>
): Promise<WebhookOutcome> {
  const provider = await getPaymentProvider();

  // (1) تحقق التوقيع/السرّ.
  const verification = provider.verifyWebhook(rawBody, headers);
  if (verification.enforced && !verification.valid) {
    return { http: 401, status: "unverified", detail: "توقيع/سرّ webhook غير صالح." };
  }

  // (2) تحليل الحدث.
  const event = provider.parseWebhook(rawBody);
  if (!event || !event.providerEventId) {
    return { http: 400, status: "rejected", detail: "حدث غير صالح." };
  }

  const { prisma } = await import("@/lib/prisma");

  // (3) تسجيل خام + منع التكرار عبر (provider, providerEventId) الفريد.
  try {
    await prisma.webhookEvent.create({
      data: {
        provider: provider.name,
        providerEventId: event.providerEventId,
        eventType: event.type,
        signatureVerified: verification.valid,
        payload: event.raw as never,
        status: "RECEIVED",
      },
    });
  } catch (e) {
    // P2002 = تكرار → حدث سبق استقباله. استجابة سريعة بلا أثر إضافي.
    if ((e as { code?: string }).code === "P2002") {
      return { http: 200, status: "duplicate" };
    }
    // خطأ آخر: لا نمنع الاستجابة (نتجنّب إعادة إرسال لا نهائية)، لكن لا نُوفي.
    return { http: 200, status: "ignored", detail: "تعذّر تسجيل الحدث." };
  }

  const finalize = async (
    status: "PROCESSED" | "FAILED" | "DEAD_LETTER",
    detail?: string
  ): Promise<void> => {
    await prisma.webhookEvent
      .updateMany({
        where: { provider: provider.name, providerEventId: event.providerEventId },
        data: { status, processedAt: new Date(), processingError: detail ?? null },
      })
      .catch(() => undefined);
  };

  // أحداث غير الدفع الناجح: تُسجَّل وتُتجاهَل.
  if (event.status !== "paid" || !event.paymentId) {
    await finalize("PROCESSED", `status=${event.status}`);
    return { http: 200, status: "ignored", detail: `status=${event.status}` };
  }

  // (4) إعادة تحقق من البوابة — لا نثق بجسم الـwebhook.
  const verified = await provider.verifyPayment(event.paymentId);
  if (!verified || verified.status !== "paid") {
    await finalize("FAILED", "verifyPayment لم يؤكّد الدفع.");
    return { http: 200, status: "rejected", detail: "الدفع غير مؤكّد من البوابة." };
  }

  // ربط الطلب عبر metadata (لا من مدخلات العميل).
  const orderId =
    (event.metadata?.orderId as string) ||
    (verified.metadata?.orderId as string) ||
    "";
  if (!orderId) {
    await finalize("FAILED", "لا orderId في metadata.");
    return { http: 200, status: "rejected", detail: "طلب غير معروف." };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    await finalize("FAILED", "الطلب غير موجود.");
    return { http: 200, status: "rejected", detail: "الطلب غير موجود." };
  }

  // (5) مطابقة المبلغ والعملة (يمنع تلاعب العميل).
  if (verified.amountHalalas !== order.totalHalalas || verified.currency !== order.currency) {
    await recordBillingAudit({
      action: "WEBHOOK_AMOUNT_MISMATCH",
      targetType: "order",
      targetId: order.id,
      metadata: {
        expected: order.totalHalalas,
        got: verified.amountHalalas,
        currency: verified.currency,
      },
    });
    await finalize("FAILED", "عدم تطابق المبلغ/العملة.");
    return { http: 200, status: "mismatch", detail: "عدم تطابق المبلغ." };
  }

  // (6) إيفاء idempotent (منح النقاط/تفعيل الاشتراك/فاتورة).
  await fulfillPaidOrder({
    orderId: order.id,
    providerPaymentId: verified.id,
    paymentMethodType: verified.methodType,
  });
  await finalize("PROCESSED");
  return { http: 200, status: "processed" };
}
