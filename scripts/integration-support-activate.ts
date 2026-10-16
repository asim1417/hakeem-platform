/**
 * تكامل خفيف على DB الحقيقي: إنشاء خيط + رسالة + رد تلقائي.
 * لا يُشغَّل في CI افتراضيًا — للتحقق اليدوي في بيئة الوكيل.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  appendMessage,
  countUserMessages,
  getOrCreateOpenThread,
  isSupportStoreReady,
  listMessages,
  listThreadsForAdmin,
} from "../lib/modules/support/support-store";
import { maybeAppendFirstMessageAutoAck } from "../lib/modules/support/auto-ack";
import { isEmailConfigured } from "../lib/modules/email/send";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL مفقود");
  }

  const ready = await isSupportStoreReady();
  assert.equal(ready, true, "جداول الدعم يجب أن تُنشأ");
  console.log("✓ support store ready");
  console.log("  email configured:", isEmailConfigured());

  const userId = `test-support-${randomUUID()}`;
  const thread = await getOrCreateOpenThread(userId, {
    userName: "مختبر الدعم",
    userEmail: "support-test@hakeem.local",
    subject: "تحقق تفعيل الدعم",
  });
  assert.ok(thread, "فشل إنشاء الخيط");
  console.log("✓ thread", thread.id);

  const before = await countUserMessages(thread.id);
  assert.equal(before, 0);

  const msg = await appendMessage({
    threadId: thread.id,
    senderRole: "user",
    senderId: userId,
    senderName: "مختبر الدعم",
    body: "السلام عليكم",
  });
  assert.ok(msg, "فشل إرسال رسالة العميل");
  console.log("✓ user message", msg.id);

  const acked = await maybeAppendFirstMessageAutoAck({
    threadId: thread.id,
    userMessageCountBefore: before,
    userBody: "السلام عليكم",
  });
  assert.equal(acked, true, "يجب إدراج الرد التلقائي");
  console.log("✓ auto-ack inserted");

  const messages = await listMessages(thread.id);
  assert.ok(messages.length >= 2);
  assert.equal(messages[0]?.senderRole, "user");
  assert.equal(messages[1]?.senderRole, "admin");
  assert.ok((messages[1]?.senderName || "").includes("تلقائي"));
  assert.ok((messages[1]?.body || "").includes("وعليكم السلام"));
  console.log("✓ messages:", messages.map((m) => `${m.senderRole}:${m.senderName}`).join(" | "));

  const threads = await listThreadsForAdmin(10);
  const found = threads.find((t) => t.id === thread.id);
  assert.ok(found, "الخيط يجب أن يظهر في صندوق الإدارة");
  assert.ok((found.preview || "").includes("السلام عليكم"), "المعاينة يجب أن تكون رسالة العميل");
  console.log("✓ admin inbox preview:", found.preview?.slice(0, 40));

  // تنظيف
  const { prisma } = await import("../lib/prisma");
  await prisma.$executeRawUnsafe(`DELETE FROM "support_threads" WHERE "id" = $1`, thread.id);
  console.log("✓ cleaned test thread");
  console.log("\nintegration-support-activate: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
