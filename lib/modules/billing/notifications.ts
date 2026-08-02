import "server-only";

// إشعارات الفوترة — HKM-BILLING-UX-001 (§13). داخلية (billing_notifications) + خطّاف بريد.
// dedupeKey يمنع التكرار المزعج. لا نرسل نصوص قضايا/مستندات (§15).

import { randomBytes } from "crypto";

export type BillingNotificationEvent =
  | "trial_started"
  | "trial_ending_7d"
  | "trial_ending_3d"
  | "balance_low_30"
  | "balance_low_15"
  | "points_purchased"
  | "subscription_started"
  | "renewal_upcoming"
  | "renewal_succeeded"
  | "payment_failed"
  | "subscription_canceled"
  | "invoice_issued"
  | "refund_succeeded";

const CATALOG: Record<BillingNotificationEvent, { titleAr: string; bodyAr: (d: Record<string, unknown>) => string }> = {
  trial_started: { titleAr: "بدأت تجربتك المجانية", bodyAr: (d) => `حصلت على ${d.points ?? 100} نقطة تجريبية.` },
  trial_ending_7d: { titleAr: "تجربتك تنتهي بعد 7 أيام", bodyAr: () => "اشترك للاستمرار دون انقطاع." },
  trial_ending_3d: { titleAr: "تجربتك تنتهي بعد 3 أيام", bodyAr: () => "اشترك الآن للحفاظ على رصيدك وميزاتك." },
  balance_low_30: { titleAr: "رصيدك منخفض", bodyAr: (d) => `تبقّى ${d.points ?? ""} نقطة (30%).` },
  balance_low_15: { titleAr: "رصيدك منخفض جدًا", bodyAr: (d) => `تبقّى ${d.points ?? ""} نقطة (15%). اشحن رصيدك.` },
  points_purchased: { titleAr: "تم شراء النقاط", bodyAr: (d) => `أُضيفت ${d.points ?? ""} نقطة إلى رصيدك.` },
  subscription_started: { titleAr: "تم تفعيل اشتراكك", bodyAr: (d) => `باقة ${d.plan ?? ""} فعّالة الآن.` },
  renewal_upcoming: { titleAr: "قرب تجديد اشتراكك", bodyAr: (d) => `سيتجدّد اشتراكك في ${d.date ?? "قريبًا"}.` },
  renewal_succeeded: { titleAr: "تم تجديد اشتراكك", bodyAr: () => "أُضيفت نقاط الدورة الجديدة." },
  payment_failed: { titleAr: "تعذّر الدفع", bodyAr: () => "لم يتم تجديد اشتراكك. حدّث وسيلة الدفع أو ادفع يدويًا." },
  subscription_canceled: { titleAr: "تم إلغاء اشتراكك", bodyAr: (d) => `يستمر حتى ${d.periodEnd ?? "نهاية الفترة"}.` },
  invoice_issued: { titleAr: "صدرت فاتورتك", bodyAr: (d) => `فاتورة رقم ${d.invoiceNumber ?? ""}.` },
  refund_succeeded: { titleAr: "تم استردادك", bodyAr: (d) => `أُعيد مبلغ ${d.amount ?? ""}.` },
};

/** تسجيل إشعار داخلي (idempotent عبر dedupeKey) + خطّاف بريد اختياري. */
export async function notify(input: {
  userId: string;
  event: BillingNotificationEvent;
  data?: Record<string, unknown>;
  dedupeKey?: string;
  email?: boolean;
}): Promise<void> {
  const spec = CATALOG[input.event];
  if (!spec) return;
  const data = input.data || {};
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.$executeRawUnsafe(
      `INSERT INTO "billing_notifications" ("id","userId","event","channel","titleAr","bodyAr","data","dedupeKey")
       VALUES ($1,$2,$3,'in_app',$4,$5,$6::jsonb,$7)
       ON CONFLICT ("dedupeKey") DO NOTHING`,
      `bn_${randomBytes(10).toString("hex")}`,
      input.userId,
      input.event,
      spec.titleAr,
      spec.bodyAr(data),
      JSON.stringify(data),
      input.dedupeKey ?? `${input.event}:${input.userId}:${Date.now()}`
    );
  } catch {
    /* لا نكسر المسار إن فشل الإشعار */
  }

  // البريد (best-effort، لا بيانات حساسة) عبر lib/modules/email/send.
  if (input.email) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
      if (user?.email) {
        const { sendEmail } = await import("@/lib/modules/email/send");
        await sendEmail({
          to: user.email,
          subject: spec.titleAr,
          html: `<div dir="rtl" style="font-family:sans-serif">${spec.titleAr}<br/>${spec.bodyAr(data)}</div>`,
          text: `${spec.titleAr} — ${spec.bodyAr(data)}`,
        });
      }
    } catch {
      /* البريد best-effort */
    }
  }
}
