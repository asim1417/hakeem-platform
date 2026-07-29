/**
 * تقرير الاستهلاك — مسارات أدمن + CSV نقي بلا Prisma.
 * npx tsx scripts/test-admin-usage-report.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

for (const f of [
  "lib/modules/billing/usage-report.ts",
  "app/admin/usage/page.tsx",
  "app/api/admin/usage/route.ts",
  "app/api/admin/usage/export/route.ts",
]) {
  assert.ok(fs.existsSync(path.join(root, f)), f);
}

const mod = read("lib/modules/billing/usage-report.ts");
assert.ok(mod.includes("export async function getUsageReport"));
assert.ok(mod.includes("export function usageReportToCsv"));
assert.ok(mod.includes("freeQuotaUsed"));
assert.ok(mod.includes("creditsBalance"));
assert.ok(mod.includes("\\uFEFF") || mod.includes("\uFEFF") || mod.includes("FEFF"));

const page = read("app/admin/usage/page.tsx");
assert.ok(page.includes("requireSuperAdminPage"));
assert.ok(page.includes("getUsageReport"));
assert.ok(page.includes("/api/admin/usage/export"));
assert.ok(page.includes("AdminPageShell"));

const api = read("app/api/admin/usage/route.ts");
assert.ok(api.includes("requireSuperAdminApi"));
assert.ok(api.includes("getUsageReport"));

const exp = read("app/api/admin/usage/export/route.ts");
assert.ok(exp.includes("usageReportToCsv"));
assert.ok(exp.includes("text/csv"));

assert.ok(read("components/admin/AdminNav.tsx").includes('"/admin/usage"'));
assert.ok(!read("components/admin/AdminNav.tsx").split("SYSTEM_LINKS")[1].includes('"/admin/usage"'));

console.log("test-admin-usage-report: OK");
