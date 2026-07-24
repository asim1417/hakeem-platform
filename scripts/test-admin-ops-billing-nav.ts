/**
 * تطوير لوحة الأدمن: تنقّل موحّد + تشغيل المهام + فوترة.
 * npx tsx scripts/test-admin-ops-billing-nav.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const mustExist = [
  "components/admin/AdminNav.tsx",
  "components/admin/AdminPageShell.tsx",
  "components/admin/AdminJobsControls.tsx",
  "components/admin/AdminBillingActions.tsx",
  "app/admin/billing/page.tsx",
  "app/api/admin/billing/route.ts",
  "app/api/admin/billing/subscription/route.ts",
  "app/api/admin/jobs/[id]/cancel/route.ts",
  "app/api/admin/jobs/[id]/retry/route.ts",
  "app/api/admin/jobs/reap-stale/route.ts",
  "lib/modules/billing/admin-overview.ts",
];
for (const f of mustExist) {
  assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
}

const nav = fs.readFileSync(path.join(root, "components/admin/AdminNav.tsx"), "utf8");
assert.ok(nav.includes('href: "/admin/billing"'));
assert.ok(nav.includes("SYSTEM_LINKS"));
assert.ok(nav.includes('variant === "super"'));
const systemBlock = nav.split("const SYSTEM_LINKS")[1] || "";
assert.ok(!systemBlock.includes('"/admin/jobs"'), "SYSTEM_ADMIN must not see jobs");
assert.ok(!systemBlock.includes('"/admin/billing"'), "SYSTEM_ADMIN must not see billing");
assert.ok(!systemBlock.includes('"/admin/services"'), "SYSTEM_ADMIN must not see services");
assert.ok(!systemBlock.includes('"/admin/audit"'), "SYSTEM_ADMIN must not see audit");
assert.ok(!systemBlock.includes('"/admin/settings"'), "SYSTEM_ADMIN must not see settings");
assert.ok(!systemBlock.includes('"/admin/ai"'), "SYSTEM_ADMIN must not see ai");
assert.ok(!systemBlock.includes('"/admin/reports"'), "SYSTEM_ADMIN must not see reports");
assert.ok(nav.includes('href: "/admin/reports"'), "super nav needs reports");

const shell = fs.readFileSync(path.join(root, "components/admin/AdminPageShell.tsx"), "utf8");
assert.ok(shell.includes("isSuperAdmin"));
assert.ok(shell.includes('variant="system"'));

const store = fs.readFileSync(path.join(root, "lib/modules/jobs/job-store.ts"), "utf8");
assert.ok(store.includes('"cancelled"'));
assert.ok(store.includes('"queued"'));
assert.ok(store.includes("cancelJob"));
assert.ok(store.includes("retryJob"));
assert.ok(store.includes("adminRetryQueued"));
assert.ok(store.includes("reapStaleRunningJobs"));
assert.ok(store.includes('"queued"'));

const jobsPage = fs.readFileSync(path.join(root, "app/admin/jobs/page.tsx"), "utf8");
assert.ok(jobsPage.includes("AdminJobRowActions"));
assert.ok(jobsPage.includes("AdminPageShell"));
assert.equal(jobsPage.includes("للمراقبة فقط"), false);

const billing = fs.readFileSync(path.join(root, "lib/modules/billing/admin-overview.ts"), "utf8");
assert.ok(billing.includes("getBillingAdminOverview"));
assert.ok(billing.includes("setUserSubscriptionStatus"));
assert.ok(billing.includes("resetUserFreeQuota"));

// كل صفحات الأدمن تستخدم الغلاف الموحّد
for (const rel of [
  "app/admin/page.tsx",
  "app/admin/users/page.tsx",
  "app/admin/roles/page.tsx",
  "app/admin/settings/page.tsx",
  "app/admin/services/page.tsx",
  "app/admin/audit/page.tsx",
  "app/admin/ai/page.tsx",
  "app/admin/api-keys/page.tsx",
  "app/admin/owner/page.tsx",
  "app/admin/billing/page.tsx",
]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.ok(src.includes("AdminPageShell"), `${rel} must use AdminPageShell`);
  assert.equal(src.includes("<AppShell>"), false, `${rel} must not use raw AppShell`);
}

const cancelApi = fs.readFileSync(
  path.join(root, "app/api/admin/jobs/[id]/cancel/route.ts"),
  "utf8"
);
assert.ok(cancelApi.includes("requireSuperAdminApi"));
assert.ok(cancelApi.includes("JOB_CANCEL"));

console.log("test-admin-ops-billing-nav: OK");
