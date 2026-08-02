import "server-only";

// دورة حياة البيانات — PDPL — HKM-BILLING-UX-001 (§14).
// حق الحذف مع الاحتفاظ الضريبي: الفواتير تبقى (التزام نظامي/ZATCA ~6 سنوات)، بينما
// تُزال وسائل الدفع وتُنقّى الحمولات الخام غير الضرورية.

import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

/**
 * إخفاء هوية بيانات الفوترة للمستخدم عند طلب الحذف (PDPL).
 * لا يمسّ الفواتير (محتفظ بها نظاميًا)؛ يزيل التوكنات ويُنقّي الحمولات الخام.
 */
export async function anonymizeUserBillingData(userId: string): Promise<{
  paymentMethodsRemoved: number;
  webhooksRedacted: number;
  paymentsRedacted: number;
}> {
  const { prisma } = await import("@/lib/prisma");
  const result = { paymentMethodsRemoved: 0, webhooksRedacted: 0, paymentsRedacted: 0 };

  // 1) إزالة وسائل الدفع (توكنات) نهائيًا.
  const pm = await prisma.paymentMethod
    .updateMany({ where: { userId }, data: { status: "REMOVED", isDefault: false, providerToken: null } })
    .catch(() => ({ count: 0 }));
  result.paymentMethodsRemoved = pm.count;

  // 2) تنقية الحمولات الخام في المدفوعات (قد تحوي بيانات وسيلة الدفع).
  const pay = await prisma.$executeRawUnsafe(
    `UPDATE "billing_payments" SET "raw_metadata" = '{"redacted":true}'::jsonb
       WHERE "order_id" IN (SELECT id FROM "billing_orders" WHERE "user_id" = $1)`,
    userId
  ).catch(() => 0);
  result.paymentsRedacted = Number(pay) || 0;

  // 3) تنقية أحداث webhook المرتبطة بطلبات المستخدم.
  const wh = await prisma.$executeRawUnsafe(
    `UPDATE "billing_webhook_events" SET "payload" = '{"redacted":true}'::jsonb
       WHERE "payload"->'metadata'->>'userId' = $1`,
    userId
  ).catch(() => 0);
  result.webhooksRedacted = Number(wh) || 0;

  await recordBillingAudit({
    action: "PDPL_ANONYMIZE",
    targetType: "user",
    targetId: userId,
    metadata: result,
  });
  return result;
}

/**
 * تنقية الحمولات الخام الأقدم من مدة الاحتفاظ (retention) — تُشغَّل دوريًا.
 * الافتراضي 400 يومًا (أطول من دورة الاسترداد، أقصر من احتفاظ الفواتير الضريبية).
 */
export async function redactOldRawPayloads(retentionDays = 400): Promise<{ webhooks: number; payments: number }> {
  const { prisma } = await import("@/lib/prisma");
  const days = Math.max(30, Math.floor(retentionDays));
  const webhooks = await prisma.$executeRawUnsafe(
    `UPDATE "billing_webhook_events" SET "payload" = '{"redacted":true}'::jsonb
       WHERE "received_at" < NOW() - ($1 || ' days')::interval
         AND "payload" <> '{"redacted":true}'::jsonb`,
    String(days)
  ).catch(() => 0);
  const payments = await prisma.$executeRawUnsafe(
    `UPDATE "billing_payments" SET "raw_metadata" = '{"redacted":true}'::jsonb
       WHERE "created_at" < NOW() - ($1 || ' days')::interval
         AND "raw_metadata" IS NOT NULL AND "raw_metadata" <> '{"redacted":true}'::jsonb`,
    String(days)
  ).catch(() => 0);
  return { webhooks: Number(webhooks) || 0, payments: Number(payments) || 0 };
}
