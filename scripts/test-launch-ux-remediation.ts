/**
 * اختبارات إصلاحات إطلاق UX (LCP / وميض / تباين / تسميات).
 * npx tsx scripts/test-launch-ux-remediation.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const layout = read("app/layout.tsx");
assert.ok(layout.includes('preload: false'), "Amiri must not preload (LCP)");
assert.ok(layout.includes('weight: ["400", "600", "700"]'), "display font weights trimmed");
assert.equal(layout.includes('weight: ["400", "500", "600", "700"]'), false);

const loading = read("app/loading.tsx");
assert.equal(loading.includes("جارٍ التحميل…"), false, "no visible loading copy flash");
assert.ok(loading.includes("aria-busy"));
assert.ok(loading.includes("--hakeem-bg"));

const hero = read("components/home/HomeHero.tsx");
assert.ok(hero.includes('h1 className="font-display'), "hero H1 uses preloaded display font");
assert.equal(hero.includes("لوحة التحكم"), false, "HomeHero must not say لوحة التحكم");
assert.ok(hero.includes("الصفحة الرئيسية"));

const globals = read("app/globals.css");
assert.ok(globals.includes(".guest-ask__auth") && globals.includes("var(--ink-80)"));
assert.ok(globals.includes(".guest-ask__hint") && globals.includes("var(--ink-70)"));

const billing = read("app/dashboard/billing/page.tsx");
const subscribe = read("app/dashboard/subscribe/page.tsx");
assert.ok(billing.includes("العودة إلى الصفحة الرئيسية"));
assert.ok(subscribe.includes("العودة إلى الصفحة الرئيسية"));
assert.equal(billing.includes("العودة إلى لوحة التحكم"), false);
assert.equal(subscribe.includes("العودة إلى لوحة التحكم"), false);

const workbench = read("components/dashboard/DashboardWorkbench.tsx");
assert.equal(workbench.includes("جارٍ تجهيز مساحة السؤال…"), false);

console.log("test-launch-ux-remediation: OK");
