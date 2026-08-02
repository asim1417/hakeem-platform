import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { getPaymentProvider } from "@/lib/payments/payment-provider";
import { adjustCredits, newIdempotencyKey } from "@/lib/modules/billing/credit-engine";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/billing/refunds/[id]/approve — تنفيذ استرداد مسموح (§12).
 * ينفّذ عبر البوابة، يعكس النقاط الممنوحة (ما أمكن)، يعلّم الحالة، ويدقّق.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const { prisma } = await import("@/lib/prisma");
  const refund = await prisma.refund.findUnique({
    where: { id: params.id },
    include: { payment: { include: { order: true } } },
  });
  if (!refund) return NextResponse.json({ message: "طلب الاسترداد غير موجود." }, { status: 404 });
  if (refund.status !== "PENDING") {
    return NextResponse.json({ message: "طلب الاسترداد ليس معلّقًا." }, { status: 400 });
  }
  const payment = refund.payment;
  if (!payment?.providerPaymentId) {
    return NextResponse.json({ message: "لا معرّف دفعة لدى البوابة." }, { status: 400 });
  }

  // 1) تنفيذ الاسترداد لدى البوابة.
  const provider = await getPaymentProvider();
  const result = await provider.refundPayment({
    providerPaymentId: payment.providerPaymentId,
    amountHalalas: refund.amountHalalas,
    reason: refund.reason ?? undefined,
  });
  if (!result.ok) {
    await recordBillingAudit({
      action: "REFUND_FAILED",
      actorUserId: gate.user.id,
      targetType: "refund",
      targetId: refund.id,
      metadata: { message: result.message },
    });
    return NextResponse.json({ message: result.message || "تعذّر الاسترداد." }, { status: 400 });
  }

  // 2) عكس النقاط الممنوحة (ما أمكن؛ إن استُهلكت لا نُدخل رصيدًا سالبًا).
  let pointsReversed = 0;
  const grantedPoints = payment.order?.pointsGranted ?? 0;
  if (grantedPoints > 0) {
    try {
      await adjustCredits({
        userId: payment.order!.userId,
        points: -grantedPoints,
        actorId: gate.user.id,
        reason: `عكس نقاط لاسترداد ${refund.id}`,
        idempotencyKey: `refund-reverse:${refund.id}`,
      });
      pointsReversed = grantedPoints;
    } catch {
      pointsReversed = 0; // النقاط استُهلكت — لا سحب قسري تحت الصفر.
    }
  }

  // 3) تحديث الحالات (استرداد كامل/جزئي).
  const fullyRefunded = refund.amountHalalas >= payment.amountHalalas;
  await prisma.$transaction([
    prisma.refund.update({
      where: { id: refund.id },
      data: { status: "SUCCEEDED", providerRefundId: result.providerRefundId ?? null, pointsReversed },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
    }),
    ...(payment.order && fullyRefunded
      ? [prisma.order.update({ where: { id: payment.order.id }, data: { status: "REFUNDED" } })]
      : []),
  ]);

  // 4) إشعار دائن (بدل تعديل الفاتورة الأصلية) — §9/ZATCA.
  let creditNoteNumber: string | null = null;
  try {
    const { issueCreditNote } = await import("@/lib/modules/billing/invoicing");
    const { splitVatInclusive, vatRateBps } = await import("@/lib/modules/credits/points");
    const originalInvoice = payment.order
      ? await prisma.invoice.findFirst({ where: { orderId: payment.order.id }, select: { invoiceNumber: true } })
      : null;
    const user = payment.order
      ? await prisma.user.findUnique({ where: { id: payment.order.userId }, select: { name: true, email: true } })
      : null;
    const bps = vatRateBps();
    const split = splitVatInclusive(refund.amountHalalas, bps);
    const note = await issueCreditNote({
      refundId: refund.id,
      userId: payment.order!.userId,
      currency: payment.currency,
      subtotalHalalas: split.subtotalHalalas,
      vatRateBps: bps,
      vatHalalas: split.vatHalalas,
      totalHalalas: split.totalHalalas,
      originalInvoiceNumber: originalInvoice?.invoiceNumber ?? null,
      buyer: { nameAr: user?.name, email: user?.email },
      issuedYear: new Date().getUTCFullYear(),
    });
    creditNoteNumber = note.invoiceNumber;
  } catch {
    // لا نُفشل الاسترداد إن تعذّر إصدار الإشعار الدائن — تلتقطه المصالحة.
  }

  await recordBillingAudit({
    action: "REFUND_APPROVED",
    actorUserId: gate.user.id,
    targetType: "refund",
    targetId: refund.id,
    metadata: { amountHalalas: refund.amountHalalas, pointsReversed, fullyRefunded, creditNoteNumber },
  });
  return NextResponse.json({ ok: true, pointsReversed, fullyRefunded, creditNoteNumber });
}
