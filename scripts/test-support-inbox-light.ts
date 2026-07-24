/**
 * تواصل خفيف عميل ↔ سوبر أدمن.
 * npx tsx scripts/test-support-inbox-light.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

for (const f of [
  "lib/modules/support/support-store.ts",
  "lib/modules/support/notify.ts",
  "app/api/support/thread/route.ts",
  "app/api/admin/support/route.ts",
  "app/api/admin/support/[threadId]/route.ts",
  "app/admin/inbox/page.tsx",
  "components/support/SupportChatWidget.tsx",
  "components/admin/AdminSupportInbox.tsx",
]) {
  assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
}

const store = read("lib/modules/support/support-store.ts");
assert.ok(store.includes("support_threads"));
assert.ok(store.includes("support_messages"));
assert.ok(store.includes("getOrCreateOpenThread"));
assert.ok(store.includes("appendMessage"));
assert.ok(store.includes("listThreadsForAdmin"));

const userApi = read("app/api/support/thread/route.ts");
assert.ok(userApi.includes("getApiUser"));
assert.ok(userApi.includes("notifyAdminNewSupportMessage"));

const adminApi = read("app/api/admin/support/route.ts");
assert.ok(adminApi.includes("requireSuperAdminApi"));

const threadApi = read("app/api/admin/support/[threadId]/route.ts");
assert.ok(threadApi.includes("requireSuperAdminApi"));
assert.ok(threadApi.includes("notifyUserSupportReply"));
assert.ok(threadApi.includes('action === "close"'));

const widget = read("components/support/SupportChatWidget.tsx");
assert.ok(widget.includes("تواصل معنا"));
assert.ok(widget.includes("/api/support/thread"));

const inbox = read("app/admin/inbox/page.tsx");
assert.ok(inbox.includes("requireSuperAdminPage"));
assert.ok(inbox.includes("AdminSupportInbox"));

const nav = read("components/admin/AdminNav.tsx");
assert.ok(nav.includes('href: "/admin/inbox"'));
const system = nav.split("const SYSTEM_LINKS")[1] || "";
assert.ok(!system.includes('"/admin/inbox"'), "SYSTEM must not see inbox");

const shell = read("components/AppShell.tsx");
assert.ok(shell.includes("SupportChatWidget"));

console.log("test-support-inbox-light: OK");
