/**
 * اختبارات التوافق الجوّال + التنقّل الآمن + مسار الرجوع.
 * npx tsx scripts/test-responsive-nav.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isSafeInternalPath,
  resolveReturnPath,
  fallbackParentPath,
  withReturnUrl,
} from "../lib/modules/nav/safe-return";
import { isResponsiveUxV2Enabled } from "../lib/modules/config/responsive-ux";

const root = process.cwd();

assert.equal(isSafeInternalPath("/dashboard"), true);
assert.equal(isSafeInternalPath("/dashboard/ask?x=1"), true);
assert.equal(isSafeInternalPath("//evil.com"), false);
assert.equal(isSafeInternalPath("https://evil.com"), false);
assert.equal(isSafeInternalPath("/\\evil"), false);
assert.equal(isSafeInternalPath(null), false);

assert.equal(
  resolveReturnPath("/dashboard/ask", "/dashboard/files"),
  "/dashboard/files"
);
assert.equal(
  resolveReturnPath("/dashboard/ask", "https://evil.com"),
  "/dashboard"
);
assert.equal(fallbackParentPath("/dashboard/judicial-assistant/cases/abc"), "/dashboard/judicial-assistant/cases");
assert.ok(withReturnUrl("/dashboard/ask", "/dashboard").includes("returnUrl="));

assert.equal(isResponsiveUxV2Enabled(), true);
process.env.NEXT_PUBLIC_RESPONSIVE_UX_V2 = "0";
assert.equal(isResponsiveUxV2Enabled(), false);
delete process.env.NEXT_PUBLIC_RESPONSIVE_UX_V2;
assert.equal(isResponsiveUxV2Enabled(), true);

const globals = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
assert.ok(globals.includes("touch-target"));
assert.ok(globals.includes("safe-area-inset-top"));
assert.ok(globals.includes("safe-area-inset-bottom"));
assert.ok(globals.includes("overflow-x: hidden") || globals.includes("overflow-x: clip"));
assert.match(globals, /\.mobile-menu-btn[\s\S]*?44px/);
assert.match(globals, /\.icon-pill[\s\S]*?44px/);
assert.ok(globals.includes("font-size: 16px"));
assert.ok(globals.includes("nav-drawer-open"));
assert.ok(globals.includes("-webkit-text-size-adjust"));

const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert.ok(layout.includes('viewportFit: "cover"'));
assert.ok(layout.includes('width: "device-width"'));
assert.ok(layout.includes("browser-compat.css") || layout.includes("next/font"));

const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");
assert.ok(shell.includes("SafeBackButton"));
assert.ok(shell.includes("DashboardHomeLink"));
assert.ok(shell.includes("ScrollRestorer"));
assert.ok(shell.includes("TopbarBreadcrumb"));

const crumb = fs.readFileSync(path.join(root, "components/TopbarBreadcrumb.tsx"), "utf8");
assert.ok(crumb.includes("مسار التنقّل"));
assert.ok(crumb.includes("/dashboard/judicial-assistant"));

const settings = fs.readFileSync(path.join(root, "app/admin/settings/page.tsx"), "utf8");
assert.ok(settings.includes("AdminPageShell"));

const docs = fs.readFileSync(path.join(root, "app/documents/layout.tsx"), "utf8");
assert.ok(docs.includes("ServiceExitBar"));

const step = fs.readFileSync(path.join(root, "components/nav/StepNav.tsx"), "utf8");
assert.ok(step.includes("السابق"));
assert.ok(step.includes("التالي"));
assert.ok(step.includes("حفظ ومتابعة لاحقًا"));

const toggles = fs.readFileSync(path.join(root, "lib/modules/admin/feature-toggles.ts"), "utf8");
assert.ok(toggles.includes("ui.responsive_ux_v2"));

console.log("test-responsive-nav: OK");
