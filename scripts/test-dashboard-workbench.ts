/**
 * جلسة عمل الداشبورد + استجابة الجوال/المتصفحات.
 * npx tsx scripts/test-dashboard-workbench.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.ok(fs.existsSync(path.join(root, "components/dashboard/DashboardWorkbench.tsx")));

const page = read("app/dashboard/page.tsx");
assert.ok(page.includes("DashboardWorkbench"));
assert.ok(page.includes("PlatformWindowBanner"));
assert.ok(page.includes('redirect("/admin")'));
assert.equal(page.includes("CardGrid"), false, "old card catalog removed");
assert.equal(page.includes("SectionTitle"), false);

const wb = read("components/dashboard/DashboardWorkbench.tsx");
assert.ok(wb.includes('className="wb-brand"'));
assert.ok(wb.includes("حكيم"));
assert.ok(wb.includes("HomeAskSurface") || wb.includes("CenterSearch"));
assert.ok(wb.includes("ماذا تعمل الآن") || wb.includes("ابدأ من الواقعة"));
assert.ok(wb.includes("/dashboard/ask"));
assert.ok(wb.includes("/dashboard/judicial-assistant"));
assert.ok(wb.includes("فتح قضية"));

const css = read("app/globals.css");
assert.ok(css.includes(".wb-stage"));
assert.ok(css.includes("nav-drawer-open"));
assert.ok(css.includes("-webkit-text-size-adjust"));
assert.ok(css.includes("prefers-reduced-motion"));
assert.ok(css.includes("min-width: 0"));
assert.ok(css.includes("overflow-x: clip") || css.includes("overflow-x: hidden"));

const mobile = read("components/MobileNav.tsx");
assert.ok(mobile.includes("nav-drawer-open"));

const shell = read("components/AppShell.tsx");
assert.ok(shell.includes("wb-safe"));

const support = read("components/support/SupportChatWidget.tsx");
assert.ok(support.includes("safe-area-inset-bottom"));

console.log("test-dashboard-workbench: OK");
