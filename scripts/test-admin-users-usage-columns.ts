/**
 * بيانات كاملة في قائمة المستخدمين + عدّاد Claude + نافذة الأسبوع الماضي.
 * npx tsx scripts/test-admin-users-usage-columns.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.ok(fs.existsSync(path.join(root, "lib/modules/billing/users-usage-snapshot.ts")));
assert.ok(fs.existsSync(path.join(root, "lib/modules/billing/ai-usage-meter.ts")));

const snap = read("lib/modules/billing/users-usage-snapshot.ts");
assert.ok(snap.includes("pastWeekWindow"));
assert.ok(snap.includes("week"));
assert.ok(snap.includes("creditsSpent"));
assert.ok(snap.includes("servicesVisited"));
assert.ok(snap.includes("claudeCalls"));
assert.ok(snap.includes("getClaudeUsageAggregates"));

const meter = read("lib/modules/billing/ai-usage-meter.ts");
assert.ok(meter.includes("ai_usage_events"));
assert.ok(meter.includes("since"));
assert.ok(meter.includes("recordAiUsageFromContext"));

const page = read("app/admin/users/page.tsx");
assert.ok(page.includes("getUsersUsageSnapshots"));
assert.ok(page.includes("pastWeekWindow"));
assert.ok(page.includes("weekCreditsSpent"));
assert.ok(page.includes("weekServicesVisited"));
assert.ok(page.includes("weekClaudeCalls"));

const mgr = read("components/AdminUsersManager.tsx");
assert.ok(mgr.includes("weekCreditsSpent"));
assert.ok(mgr.includes("weekServicesVisited"));
assert.ok(mgr.includes("خدمات الأسبوع"));
assert.ok(mgr.includes("مخصوم الأسبوع"));
assert.ok(mgr.includes("Claude الأسبوع"));
assert.ok(mgr.includes("weekLabel"));

console.log("test-admin-users-usage-columns: OK");
