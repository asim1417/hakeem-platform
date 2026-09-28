/**
 * ملفي المهني بعد الاكتمال يجب أن يفتح للتعديل لا شاشة «اكتمل» المسدودة.
 * وبعد الإكمال لأول مرة يُحوَّل تلقائيًا للوحة.
 * npx tsx scripts/test-professional-profile-edit.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const wizard = fs.readFileSync(path.join(root, "components/onboarding/OnboardingWizard.tsx"), "utf8");
const page = fs.readFileSync(path.join(root, "app/onboarding/page.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");

assert.ok(shell.includes('href="/onboarding"') && shell.includes("ملفي المهني"), "رابط الشريط الجانبي");
assert.ok(page.includes("initiallyCompleted={profile.onboardingCompleted === true}"), "تمرير حالة الاكتمال");
assert.ok(wizard.includes("setCelebrate(false)"), "لا احتفال عند فتح ملف مكتمل");
assert.ok(wizard.includes("ملفي المهني — تعديل البيانات"), "عنوان وضع التعديل");
assert.ok(wizard.includes("تعديل الملف المهني"), "زر الرجوع للتعديل من شاشة الاحتفال");
assert.ok(!/if \(p\.onboardingCompleted\) setDone\(true\)/.test(wizard), "لا setDone(true) عند التحميل");

// بعد الإكمال: تحويل تلقائي للوحة الداخلية
assert.ok(wizard.includes("AFTER_COMPLETE_MS") && wizard.includes("DASHBOARD_AFTER_COMPLETE"), "ثوابت التحويل");
assert.ok(wizard.includes("router.replace(DASHBOARD_AFTER_COMPLETE)"), "تحويل للوحة بعد الإكمال");
assert.ok(wizard.includes("جارٍ فتح لوحتك"), "رسالة التحويل التلقائي");
assert.ok(
  /if \(!celebrate\) return;[\s\S]*setTimeout[\s\S]*router\.replace\(DASHBOARD_AFTER_COMPLETE\)/.test(wizard),
  "مؤقّت التحويل عند الاحتفال"
);

console.log("test-professional-profile-edit: OK");
