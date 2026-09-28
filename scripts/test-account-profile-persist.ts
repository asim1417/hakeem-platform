/**
 * الحساب والرصيد + ملفي المهني: لا يُسقط onboardingCompleted عند حفظ وسيط،
 * وواجهة الرصيد تعرض النقاط والملف، والساحر يؤكّد الحفظ.
 * npx tsx scripts/test-account-profile-persist.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const onboardingApi = fs.readFileSync(path.join(root, "app/api/onboarding/route.ts"), "utf8");
const essentialsApi = fs.readFileSync(path.join(root, "app/api/profile/essentials/route.ts"), "utf8");
const billingPage = fs.readFileSync(path.join(root, "app/dashboard/billing/page.tsx"), "utf8");
const statusCard = fs.readFileSync(path.join(root, "components/billing/BillingStatusCard.tsx"), "utf8");
const wizard = fs.readFileSync(path.join(root, "components/onboarding/OnboardingWizard.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");

// ── API: لا تعيين onboardingCompleted: false عند خطوة وسيطة ──
assert.ok(
  onboardingApi.includes("existing.onboardingCompleted") &&
    onboardingApi.includes("onboardingCompleted: true as const"),
  "حفظ وسيط يحافظ على الاكتمال إن وُجد"
);
assert.ok(
  !/onboardingCompleted:\s*isComplete\b/.test(onboardingApi),
  "لا يُمرَّر isComplete مباشرةً فيُسقط الاكتمال"
);
assert.ok(
  essentialsApi.includes("onboardingCompleted: true"),
  "بوابة الأساسيات تُعلّم الملف مكتملًا"
);

// ── الحساب والرصيد: نقاط + ملف مهني + أيقونات ──
assert.ok(billingPage.includes("getCreditsStatus"), "جلب نقاط حكيم");
assert.ok(billingPage.includes("getProfile"), "جلب الملف المهني");
assert.ok(billingPage.includes("نقاط حكيم") && billingPage.includes("الملف المهني"), "بطاقات الرصيد والملف");
assert.ok(billingPage.includes("Coins") && billingPage.includes("UserRound"), "أيقونات الرصيد والملف");
assert.ok(billingPage.includes('showPlansLink={paidUi}'), "إخفاء رابط الخطط عند إغلاق الواجهة المدفوعة");
assert.ok(statusCard.includes("showPlansLink"), "BillingStatusCard يدعم إخفاء الخطط");

// ── الساحر: تأكيد الحفظ ووضع التعديل ──
assert.ok(wizard.includes("تم الحفظ") || wizard.includes("تم حفظ تعديلات"), "رسالة تأكيد الحفظ");
assert.ok(wizard.includes('tone="success"'), "تنبيه نجاح بعد الحفظ");
assert.ok(wizard.includes("alreadyComplete") && wizard.includes("setSaveOk"), "وضع التعديل لا يُعيد الاحتفال بلا داعٍ");

// ── الشريط: أيقونات روابط الحساب والملف ──
assert.ok(shell.includes("Coins") && shell.includes("UserRound"), "أيقونات السايدبار");
assert.ok(shell.includes('href="/dashboard/billing"') && shell.includes('href="/onboarding"'), "روابط الحساب والملف");

console.log("test-account-profile-persist: OK");
