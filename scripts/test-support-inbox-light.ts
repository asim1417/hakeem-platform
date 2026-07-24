/**
 * تواصل خفيف + صندوق مراسلات مع اسم المرسل.
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
assert.ok(store.includes("user_name"));
assert.ok(store.includes("user_email"));
assert.ok(store.includes("sender_name"));
assert.ok(store.includes("getOrCreateOpenThread"));
assert.ok(store.includes("listThreadsForAdmin"));
assert.ok(store.includes("ADD COLUMN IF NOT EXISTS"));

const userApi = read("app/api/support/thread/route.ts");
assert.ok(userApi.includes("userName: user.name"));
assert.ok(userApi.includes("userEmail: user.email"));
assert.ok(userApi.includes("senderName: user.name"));

const adminApi = read("app/api/admin/support/[threadId]/route.ts");
assert.ok(adminApi.includes("senderName: gate.user.name"));

const inbox = read("app/admin/inbox/page.tsx");
assert.ok(inbox.includes("صندوق المراسلات"));
assert.ok(inbox.includes("listThreadsForAdmin"));
assert.ok(inbox.includes("initialThreads"));

const ui = read("components/admin/AdminSupportInbox.tsx");
assert.ok(ui.includes("المرسل:"));
assert.ok(ui.includes("senderLabel"));
assert.ok(ui.includes("userEmail"));

const shell = read("components/admin/SuperAdminShell.tsx");
assert.ok(shell.includes("/admin/inbox"));
assert.ok(shell.includes("صندوق المراسلات"));
assert.ok(shell.includes("countUnreadForAdmin"));

const appShell = read("components/AppShell.tsx");
assert.ok(appShell.includes('user.role !== "SUPER_ADMIN"'));

const nav = read("components/admin/AdminNav.tsx");
assert.ok(nav.includes("صندوق المراسلات"));

console.log("test-support-inbox-light: OK");
