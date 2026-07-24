/**
 * P0 الدعم: شارة غير مقروء + rate limit + نصوص.
 * npx tsx scripts/test-support-p0.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  __resetSupportRateLimitForTests,
  consumeSupportSendLimit,
} from "../lib/modules/support/rate-limit";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const store = read("lib/modules/support/support-store.ts");
assert.ok(store.includes("countUnreadForUser"));

const api = read("app/api/support/thread/route.ts");
assert.ok(api.includes("peek=1") || api.includes('peek") === "1"'));
assert.ok(api.includes("countUnreadForUser"));
assert.ok(api.includes("consumeSupportSendLimit"));
assert.ok(api.includes("429"));

const widget = read("components/support/SupportChatWidget.tsx");
assert.ok(widget.includes("peek=1"));
assert.ok(widget.includes("الدعم والمساعدة") || widget.includes("الدعم"));
assert.ok(widget.includes("يصل رد الدعم هنا") || widget.includes("الرد يظهر في هذه المحادثة"));
assert.doesNotMatch(widget, /يصل رد الإدارة إلى صندوق المراسلات/);
assert.ok(widget.includes("DRAFT_KEY") || widget.includes("hakeem-support-draft"));

const errPage = read("app/error.tsx");
assert.ok(errPage.includes("لوحة التحكم والدعم") || errPage.includes("/dashboard"));
assert.doesNotMatch(errPage, /فتواصل مع الدعم\./);

__resetSupportRateLimitForTests();
const uid = "user-test-rl";
for (let i = 0; i < 20; i += 1) {
  assert.equal(consumeSupportSendLimit(uid).allowed, true);
}
const blocked = consumeSupportSendLimit(uid);
assert.equal(blocked.allowed, false);
assert.ok(blocked.retryAfterSec >= 1);

__resetSupportRateLimitForTests();
assert.equal(consumeSupportSendLimit(uid).allowed, true);

console.log("test-support-p0: OK");
