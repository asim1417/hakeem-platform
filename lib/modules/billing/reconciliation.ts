import "server-only";

// المصالحة اليومية — HKM-BILLING-UX-001 (§18). يقارن الطلبات/المدفوعات/النقاط/الفواتير/البوابة،
// يحرّر الحجوزات العالقة، يُنهي الأرصدة المنتهية، ويُبلّغ عن أي اختلاف (BillingAuditLog).

import { releaseUsageCredits, expireBuckets } from "@/lib/modules/credits/usage-ledger";
import { expireCredits } from "@/lib/modules/billing/credit-engine";
import { getPaymentProvider } from "@/lib/payments/payment-provider";
import { fulfillPaidOrder } from "@/lib/modules/billing/fulfillment";
import { issueInvoiceForOrder } from "@/lib/modules/billing/invoicing";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

export interface ReconciliationReport {
  staleReservationsReleased: number;
  expiredPoints: number;
  ordersInvoiced: number;
  paymentsRecovered: number;
  mismatches: number;
}

export async function runReconciliation(now: Date = new Date()): Promise<ReconciliationReport> {
  const { prisma } = await import("@/lib/prisma");
  const report: ReconciliationReport = {
    staleReservationsReleased: 0,
    expiredPoints: 0,
    ordersInvoiced: 0,
    paymentsRecovered: 0,
    mismatches: 0,
  };

  // (1) تحرير الحجوزات العالقة (held ومنتهية الصلاحية).
  try {
    const stale = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_reservations"
        WHERE status = 'held' AND "expiresAt" <= $1 LIMIT 1000`,
      now
    );
    for (const r of stale) {
      await releaseUsageCredits(r.id);
      report.staleReservationsReleased++;
    }
  } catch {
    /* الجدول غير موجود بعد */
  }

  // (2) إنهاء الأرصدة المنتهية.
  report.expiredPoints = await expireCredits().catch(() => 0);
  await expireBuckets().catch(() => 0);

  // (3) استرجاع المدفوعات المعلّقة من البوابة (نجحت لكن webhook فات).
  try {
    const provider = await getPaymentProvider();
    const pending = await prisma.payment.findMany({
      where: { status: { in: ["PENDING", "INITIATED"] }, providerPaymentId: { not: null }, createdAt: { lte: new Date(now.getTime() - 10 * 60 * 1000) } },
      take: 200,
    });
    for (const p of pending) {
      const verified = await provider.verifyPayment(p.providerPaymentId!);
      if (verified?.status === "paid") {
        const order = await prisma.order.findUnique({ where: { id: p.orderId } });
        if (order && verified.amountHalalas === order.totalHalalas) {
          await fulfillPaidOrder({ orderId: order.id, providerPaymentId: verified.id });
          report.paymentsRecovered++;
        } else if (order) {
          report.mismatches++;
          await recordBillingAudit({
            action: "RECON_AMOUNT_MISMATCH",
            targetType: "order",
            targetId: order.id,
            metadata: { expected: order.totalHalalas, got: verified.amountHalalas },
          });
        }
      }
    }
  } catch {
    /* */
  }

  // (4) طلبات مدفوعة بلا فاتورة → إصدار.
  try {
    const paidNoInvoice = await prisma.$queryRawUnsafe<
      { id: string; user_id: string; currency: string; subtotal_halalas: number; vat_halalas: number; total_halalas: number; type: string }[]
    >(
      `SELECT o.id, o."user_id", o."currency", o."subtotal_halalas", o."vat_halalas", o."total_halalas", o."type"
         FROM "billing_orders" o
         LEFT JOIN "billing_invoices" i ON i."order_id" = o.id
        WHERE o."status" = 'PAID' AND i.id IS NULL
        LIMIT 200`
    );
    for (const o of paidNoInvoice) {
      const user = await prisma.user.findUnique({ where: { id: o.user_id }, select: { name: true, email: true } });
      await issueInvoiceForOrder({
        orderId: o.id,
        userId: o.user_id,
        currency: o.currency,
        subtotalHalalas: o.subtotal_halalas,
        vatRateBps: o.subtotal_halalas > 0 ? Math.round((o.vat_halalas * 10000) / o.subtotal_halalas) : 1500,
        vatHalalas: o.vat_halalas,
        totalHalalas: o.total_halalas,
        type: o.type === "POINTS_PACKAGE" ? "SIMPLIFIED_TAX_INVOICE" : "TAX_INVOICE",
        buyer: { nameAr: user?.name, email: user?.email },
        issuedYear: now.getUTCFullYear(),
      }).catch(() => undefined);
      report.ordersInvoiced++;
    }
  } catch {
    /* */
  }

  if (report.mismatches > 0) {
    await recordBillingAudit({
      action: "RECONCILIATION_MISMATCHES",
      metadata: { count: report.mismatches, report: JSON.parse(JSON.stringify(report)) },
    });
  }
  return report;
}
