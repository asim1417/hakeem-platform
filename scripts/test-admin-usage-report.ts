/**
 * لوحة الاستهلاك الكاملة — مسارات أدمن بلا Prisma.
 * npx tsx scripts/test-admin-usage-report.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

for (const f of [
  "lib/modules/billing/usage-report.ts",
  "lib/modules/billing/usage-user-detail.ts",
  "app/admin/usage/page.tsx",
  "app/admin/usage/[userId]/page.tsx",
  "app/api/admin/usage/route.ts",
  "app/api/admin/usage/export/route.ts",
  "app/api/admin/usage/[userId]/route.ts",
]) {
  assert.ok(fs.existsSync(path.join(root, f)), f);
}

const mod = read("lib/modules/billing/usage-report.ts");
assert.ok(mod.includes("export async function getUsageReport"));
assert.ok(mod.includes("export function usageReportToCsv"));
assert.ok(mod.includes("activityScore"));
assert.ok(mod.includes("consultations"));
assert.ok(mod.includes("askConversations"));
assert.ok(mod.includes("aiEvents"));
assert.ok(mod.includes("enrichUsers"));

const detail = read("lib/modules/billing/usage-user-detail.ts");
assert.ok(detail.includes("getUsageUserDetail"));
assert.ok(detail.includes("timeline"));
assert.ok(detail.includes("activityLabel"));

const page = read("app/admin/usage/page.tsx");
assert.ok(page.includes("requirePagePermission"));
assert.ok(page.includes("ADMIN_REPORTS_VIEW"));
assert.ok(page.includes("/admin/usage/"));
assert.ok(page.includes("activityScore") || page.includes("النشاط"));
assert.ok(page.includes("active_users"));
assert.equal(page.includes("requireSuperAdminPage"), false);

const userPage = read("app/admin/usage/[userId]/page.tsx");
assert.ok(userPage.includes("getUsageUserDetail"));
assert.ok(userPage.includes("الخط الزمني"));
assert.ok(userPage.includes("requirePagePermission"));
assert.ok(userPage.includes("ADMIN_REPORTS_VIEW"));

assert.ok(read("app/api/admin/usage/route.ts").includes("requireApiPermission"));
assert.ok(read("app/api/admin/usage/[userId]/route.ts").includes("getUsageUserDetail"));
assert.ok(read("components/admin/AdminNav.tsx").includes('"/admin/usage"'));
const systemNav = read("components/admin/AdminNav.tsx").split("SYSTEM_LINKS")[1] || "";
assert.ok(systemNav.includes('"/admin/usage"'), "system admin nav must include usage");

console.log("test-admin-usage-report: OK");
