/**
 * تفعيل الدعم: رد تلقائي أول رسالة + حالة الصندوق.
 * npx tsx scripts/test-support-activate.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildSupportAutoAck } from "../lib/modules/support/auto-ack-text";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.ok(fs.existsSync(path.join(root, "lib/modules/support/auto-ack.ts")));

const ackSalam = buildSupportAutoAck("السلام عليكم");
assert.ok(ackSalam.includes("وعليكم السلام"));
assert.ok(ackSalam.includes("صندوق دعم حكيم"));

const ackOther = buildSupportAutoAck("عندي مشكلة في الدخول");
assert.equal(ackOther.includes("وعليكم السلام"), false);
assert.ok(ackOther.includes("استلمنا رسالتك"));

const api = read("app/api/support/thread/route.ts");
assert.ok(api.includes("maybeAppendFirstMessageAutoAck"));
assert.ok(api.includes("countUserMessages"));
assert.ok(api.includes("autoAcked"));
assert.ok(api.includes("notifyAdminNewSupportMessage"));

const notify = read("lib/modules/support/notify.ts");
assert.ok(notify.includes("isEmailConfigured"));
assert.ok(notify.includes("SupportNotifyResult"));
assert.ok(notify.includes("PLATFORM_OWNER_EMAILS"));

const store = read("lib/modules/support/support-store.ts");
assert.ok(store.includes("isSupportStoreReady"));
assert.ok(store.includes("countUserMessages"));
assert.ok(store.includes("logSupportError") || store.includes("[support-store:"));
assert.ok(store.includes('sender_role = \'user\''));

const inbox = read("app/admin/inbox/page.tsx");
assert.ok(inbox.includes("isEmailConfigured"));
assert.ok(inbox.includes("isSupportStoreReady"));
assert.ok(inbox.includes("حالة تفعيل الدعم"));
assert.ok(inbox.includes("RESEND_API_KEY"));

const widget = read("components/support/SupportChatWidget.tsx");
assert.ok(widget.includes("autoAcked"));
assert.ok(widget.includes("setPending"));
assert.doesNotMatch(widget, /useTransition/);

const adminUi = read("components/admin/AdminSupportInbox.tsx");
assert.ok(adminUi.includes("تلقائي"));

console.log("test-support-activate: OK");
