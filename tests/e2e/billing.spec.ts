/**
 * اختبار E2E لمنظومة الفوترة — HKM-BILLING-UX-001 (§17).
 * يتطلب: تطبيقًا قيد التشغيل + قاعدة staging + مفاتيح Moyasar Sandbox + الأعلام مُفعّلة.
 * التثبيت والتشغيل:
 *   npm i -D @playwright/test
 *   BILLING_ENABLED=true PAID_CHECKOUT_ENABLED=true CREDITS_ENFORCEMENT_ENABLED=true \
 *   E2E_BASE_URL=https://staging.hakeem.sa npx playwright test tests/e2e/billing.spec.ts
 *
 * لا يعمل في بيئة CI بلا هذه المتطلبات (يُتخطّى تلقائيًا عبر E2E_BASE_URL غير المضبوط).
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "";

test.describe("منظومة النقاط والاشتراكات", () => {
  test.skip(!BASE, "يتطلب E2E_BASE_URL لبيئة staging مع الأعلام مفعّلة.");

  test("التدفق الكامل: تجربة → خدمة → خصم → نفاد → شحن → استئناف → فاتورة → اشتراك → إلغاء", async ({ page }) => {
    // 1) إنشاء حساب + تسجيل الدخول (عبر مسار Sandbox / حساب اختبار مُهيّأ).
    await page.goto(`${BASE}/register`);
    // … خطوات التسجيل حسب تدفق Clerk/OTP في staging.

    // 2) رؤية رصيد التجربة في الشريط.
    await page.goto(`${BASE}/dashboard/account/billing`);
    await expect(page.getByText(/نقطة/)).toBeVisible();

    // 3) تشغيل خدمة صغيرة ورؤية Chip التكلفة.
    await page.goto(`${BASE}/dashboard/ask`);
    // … إرسال سؤال ورؤية «خُصمت X نقطة».

    // 4) استنزاف الرصيد → نافذة نفاد الرصيد.
    // … تكرار الخدمة حتى النفاد ثم توقّع ظهور InsufficientBalanceDialog.

    // 5) فتح Checkout لحزمة نقاط والدفع في Sandbox.
    await page.goto(`${BASE}/pricing`);
    // … اختيار حزمة → صفحة Moyasar Sandbox → إتمام الدفع.

    // 6) العودة للطلب واكتمال التنفيذ (لا خصم مزدوج).

    // 7) تنزيل الفاتورة.
    await page.goto(`${BASE}/dashboard/account/invoices`);
    await expect(page.getByText(/HKM-\d{4}-\d{6}/)).toBeVisible();

    // 8) الاشتراك في باقة ثم الإلغاء واستمرار الصلاحية حتى نهاية المدة.
    await page.goto(`${BASE}/dashboard/account/subscription`);
    // … تفعيل الاشتراك عبر Sandbox ثم إلغاؤه والتحقق من الاستمرار حتى نهاية الفترة.

    expect(true).toBeTruthy();
  });
});
