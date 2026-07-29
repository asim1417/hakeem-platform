/**
 * رصد الأسبوع الماضي ببيانات مؤكّدة.
 * npx tsx scripts/test-admin-week-verified.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.ok(fs.existsSync(path.join(root, "lib/modules/billing/week-verified-report.ts")));
assert.ok(fs.existsSync(path.join(root, "app/admin/usage/week/page.tsx")));
assert.ok(fs.existsSync(path.join(root, "app/api/admin/usage/week/export/route.ts")));

const mod = read("lib/modules/billing/week-verified-report.ts");
assert.ok(mod.includes("getWeekVerifiedReport"));
assert.ok(mod.includes("chat_messages"));
assert.ok(mod.includes("credit_transactions"));
assert.ok(mod.includes("limitations"));
assert.ok(mod.includes("claudeTokensVerified"));

const page = read("app/admin/usage/week/page.tsx");
assert.ok(page.includes("getWeekVerifiedReport"));
assert.ok(page.includes("بيانات مؤكّدة"));
assert.ok(page.includes("/api/admin/usage/week/export"));

const nav = read("components/admin/AdminNav.tsx");
assert.ok(nav.includes("/admin/usage/week"));

const usageHome = read("app/admin/usage/page.tsx");
assert.ok(usageHome.includes("/admin/usage/week"));

const anthropic = read("lib/modules/hakeem-agent/anthropic.ts");
assert.ok(anthropic.includes("recordAiUsageFromContext"));

const gateway = read("lib/modules/ai/ai-gateway.ts");
assert.ok(gateway.includes("recordAiUsageFromContext"));

console.log("test-admin-week-verified: OK");
