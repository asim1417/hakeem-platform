/**
 * راية مركزية لظهور واجهة الدفع المدفوع.
 * لا تغيّر منطق الحصص أو مسارات API — تتحكم بالـ CTA الظاهر فقط.
 */
import { isCheckoutLive } from "@/config/pricing";

/**
 * هل نعرض دعوات الاشتراك المدفوع وأزرار الدفع؟
 * - افتراضيًا: فقط عندما تكون بوابة Moyasar مهيّأة فعليًا.
 * - PAID_CHECKOUT_UI_ENABLED=0 → إخفاء دائم للـ CTA المدفوع.
 * - PAID_CHECKOUT_UI_ENABLED=1 → إظهار فقط إن كانت البوابة حية.
 */
export function isPaidCheckoutUiEnabled(): boolean {
  const flag = (process.env.PAID_CHECKOUT_UI_ENABLED || "").trim();
  if (flag === "0") return false;
  return isCheckoutLive();
}
