/**
 * غلاف إدارة السوبر منفصل عن داشبورد العميل + نافذة المنصة.
 * npx tsx scripts/test-super-admin-ops-shell.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  defaultHomeForUser,
  resolvePostLoginNext,
  PLATFORM_WINDOW_HREF,
} from "../lib/modules/auth/home-destination";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.equal(defaultHomeForUser({ role: "SUPER_ADMIN" }), "/admin");
assert.equal(defaultHomeForUser({ role: "LAWYER" }), "/dashboard");
assert.equal(resolvePostLoginNext({ role: "SUPER_ADMIN" }, "/dashboard"), "/admin");
assert.equal(
  resolvePostLoginNext({ role: "SUPER_ADMIN" }, "/dashboard?platform=1"),
  "/dashboard?platform=1"
);
assert.equal(resolvePostLoginNext({ role: "SUPER_ADMIN" }, "/dashboard/ask"), "/dashboard/ask");
assert.equal(resolvePostLoginNext({ role: "LAWYER" }, "/dashboard"), "/dashboard");
assert.equal(PLATFORM_WINDOW_HREF, "/dashboard?platform=1");

for (const f of [
  "components/admin/SuperAdminShell.tsx",
  "components/admin/PlatformWindowBanner.tsx",
  "lib/modules/auth/home-destination.ts",
]) {
  assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
}

const shell = read("components/admin/AdminPageShell.tsx");
assert.ok(shell.includes("SuperAdminShell"));
assert.ok(shell.includes("AppShell"));
assert.ok(shell.includes('variant="system"'));

const superShell = read("components/admin/SuperAdminShell.tsx");
assert.ok(superShell.includes("لوحة التشغيل"));
assert.ok(superShell.includes("نافذة المنصة"));
assert.ok(superShell.includes("PLATFORM_WINDOW_HREF"));
assert.equal(superShell.includes("SupportChatWidget"), false);

const continuePage = read("app/auth/continue/page.tsx");
assert.ok(continuePage.includes("resolvePostLoginNext"));

const dash = read("app/dashboard/page.tsx");
assert.ok(dash.includes('platform === "1"'));
assert.ok(dash.includes('redirect("/admin")'));
assert.ok(dash.includes("PlatformWindowBanner"));

const adminHome = read("app/admin/page.tsx");
assert.ok(adminHome.includes("مركز الإدارة"));
assert.ok(adminHome.includes("PLATFORM_WINDOW_HREF") || adminHome.includes("نافذة المنصة"));
assert.ok(adminHome.includes("افتح نافذة المنصة الآن"));

const mw = read("middleware.ts");
assert.ok(mw.includes("nextUrl.search"));

console.log("test-super-admin-ops-shell: OK");
