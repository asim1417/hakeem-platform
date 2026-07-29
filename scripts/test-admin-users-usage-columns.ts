/**
 * بيانات كاملة في قائمة المستخدمين + عدّاد Claude.
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
assert.ok(snap.includes("consultations"));
assert.ok(snap.includes("claudeCalls"));
assert.ok(snap.includes("getClaudeUsageAggregates"));
assert.ok(snap.includes("legalChatConversations"));
assert.ok(snap.includes("jaConversations"));

const meter = read("lib/modules/billing/ai-usage-meter.ts");
assert.ok(meter.includes("ai_usage_events"));
assert.ok(meter.includes("recordAiUsageFromContext"));
assert.ok(meter.includes("enterAiUsageContext"));
assert.ok(meter.includes("input_tokens"));

const aiConfig = read("lib/modules/ai/ai-config.ts");
assert.ok(aiConfig.includes("recordAiUsageFromContext"));
assert.ok(aiConfig.includes("input_tokens"));

const page = read("app/admin/users/page.tsx");
assert.ok(page.includes("getUsersUsageSnapshots"));
assert.ok(page.includes("claudeCalls"));
assert.ok(page.includes("claudeInputTokens"));
assert.ok(page.includes("/admin/usage"));

const mgr = read("components/AdminUsersManager.tsx");
assert.ok(mgr.includes("freeQuotaUsed"));
assert.ok(mgr.includes("creditsBalance"));
assert.ok(mgr.includes("الخدمات"));
assert.ok(mgr.includes("Claude"));
assert.ok(mgr.includes("claudeCalls"));
assert.ok(mgr.includes("consultations"));
assert.ok(mgr.includes("/admin/usage/"));

const detail = read("lib/modules/billing/usage-user-detail.ts");
assert.ok(detail.includes("claudeInputTokens"));
assert.ok(detail.includes("getClaudeUsageAggregates"));

console.log("test-admin-users-usage-columns: OK");
