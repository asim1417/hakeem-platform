/**
 * استهلاك داخل قائمة المستخدمين.
 * npx tsx scripts/test-admin-users-usage-columns.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.ok(fs.existsSync(path.join(root, "lib/modules/billing/users-usage-snapshot.ts")));
const page = read("app/admin/users/page.tsx");
assert.ok(page.includes("getUsersUsageSnapshots"));
assert.ok(page.includes("freeQuotaUsed"));
assert.ok(page.includes("/admin/usage"));

const mgr = read("components/AdminUsersManager.tsx");
assert.ok(mgr.includes("freeQuotaUsed"));
assert.ok(mgr.includes("creditsBalance"));
assert.ok(mgr.includes("subscriptionStatus"));
assert.ok(mgr.includes("/admin/usage/"));
assert.ok(mgr.includes("الحصّة"));
assert.ok(mgr.includes("النقاط"));

console.log("test-admin-users-usage-columns: OK");
