/**
 * اختبارات دفعة UX P0 — قائمة حساب، تسميات، فوترة، ومضات.
 * npx tsx scripts/test-ux-postlogin-p0.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isBareDashboardPath,
} from "../lib/modules/auth/request-path-headers";
import { isPaidCheckoutUiEnabled } from "../lib/modules/billing/checkout-visibility";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

// ── توجيه السوبر قبل الرسم ──
assert.equal(isBareDashboardPath("/dashboard", ""), true);
assert.equal(isBareDashboardPath("/dashboard", "?platform=1"), false);
assert.equal(isBareDashboardPath("/dashboard", "?platform=true"), false);
assert.equal(isBareDashboardPath("/dashboard/ask", ""), false);

const layout = read("app/dashboard/layout.tsx");
assert.ok(layout.includes("isBareDashboardPath"));
assert.ok(layout.includes('redirect("/admin")'));
assert.ok(layout.includes("isSuperAdmin"));

const mw = read("middleware.ts");
assert.ok(mw.includes("x-hakeem-pathname") || mw.includes("HAKEEM_PATHNAME_HEADER"));
assert.ok(mw.includes("nextWithPath"));

// ── قائمة حساب ──
const shell = read("components/AppShell.tsx");
assert.ok(shell.includes("AccountMenu"));
assert.ok(shell.includes("ملفي المهني"));
assert.ok(shell.includes("nav.ask"));
assert.ok(shell.includes("/dashboard/ask"));
assert.ok(shell.includes("LogoutButton")); // يبقى مؤقتًا في السايدبار
assert.doesNotMatch(shell, /TopbarUserBar/);
assert.doesNotMatch(shell, /LogoutIconButton/);
assert.ok(shell.includes("topbar.askPlaceholder") || shell.includes("askPlaceholder"));

const account = read("components/AccountMenu.tsx");
assert.ok(account.includes("ملفي المهني"));
assert.ok(account.includes("/onboarding"));
assert.ok(account.includes("/dashboard/billing"));
assert.ok(account.includes("تسجيل الخروج"));
assert.ok(account.includes('role="menu"'));
assert.ok(account.includes("aria-expanded"));
assert.ok(account.includes("min-h-[44px]") || account.includes("touch-target"));

// ── تسميات ──
const dict = read("lib/i18n/dictionaries.ts");
assert.ok(dict.includes('"nav.library": "المكتبة النظامية"'));
assert.ok(dict.includes('"nav.myFiles": "مساحتي"'));
assert.ok(dict.includes('"nav.platformAdmin": "إدارة المنصة"'));
assert.ok(dict.includes("اسأل حكيم عن مسألة قانونية"));

const crumb = read("components/TopbarBreadcrumb.tsx");
assert.ok(crumb.includes('"المكتبة النظامية"'));
assert.ok(crumb.includes('"مساحتي"'));
assert.ok(crumb.includes('"ملفي المهني"'));
assert.ok(crumb.includes('"الحساب والرصيد"'));

assert.doesNotMatch(shell, /الحساب والإعدادات/);
assert.ok(shell.includes("billingLabel"));
assert.ok(shell.includes("isPaidCheckoutUiEnabled"));

// ── Essentials داخل المنصة ──
const essentials = read("components/onboarding/EssentialsPrompt.tsx");
assert.ok(essentials.includes("استكمال ملفك في حكيم"));
assert.doesNotMatch(essentials, /login-page/);

// ── فوترة / راية دفع ──
const visibility = read("lib/modules/billing/checkout-visibility.ts");
assert.ok(visibility.includes("isPaidCheckoutUiEnabled"));
assert.ok(visibility.includes("PAID_CHECKOUT_UI_ENABLED"));

const billing = read("app/dashboard/billing/page.tsx");
assert.ok(billing.includes("isPaidCheckoutUiEnabled"));
assert.ok(billing.includes("الخطط المدفوعة ستتاح قريبًا") || billing.includes("الحساب والرصيد"));
assert.doesNotMatch(billing, /اضبط Moyasar/);

const subscribe = read("app/dashboard/subscribe/page.tsx");
assert.ok(subscribe.includes("paidUiEnabled={paidUi}"));
assert.doesNotMatch(subscribe, /اضبط Moyasar/);

const plans = read("config/pricing.ts");
assert.ok(plans.includes("الخطط المدفوعة ستتاح قريبًا"));
assert.doesNotMatch(plans, /اضبط Moyasar/);

// راية الدفع: بدون مفتاح → معطّلة
const prev = process.env.MOYASAR_SECRET_KEY;
const prevFlag = process.env.PAID_CHECKOUT_UI_ENABLED;
delete process.env.MOYASAR_SECRET_KEY;
delete process.env.PAID_CHECKOUT_UI_ENABLED;
assert.equal(isPaidCheckoutUiEnabled(), false);
process.env.PAID_CHECKOUT_UI_ENABLED = "0";
process.env.MOYASAR_SECRET_KEY = "sk_test";
assert.equal(isPaidCheckoutUiEnabled(), false);
if (prev === undefined) delete process.env.MOYASAR_SECRET_KEY;
else process.env.MOYASAR_SECRET_KEY = prev;
if (prevFlag === undefined) delete process.env.PAID_CHECKOUT_UI_ENABLED;
else process.env.PAID_CHECKOUT_UI_ENABLED = prevFlag;

// ── AdminNav فرعي لمدير النظام ──
const adminNav = read("components/admin/AdminNav.tsx");
assert.ok(adminNav.includes("أقسام الإدارة"));

const superShell = read("components/admin/SuperAdminShell.tsx");
assert.ok(superShell.includes("AccountMenu"));

console.log("test-ux-postlogin-p0: OK");
