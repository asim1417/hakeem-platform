/**
 * اختبار محرك الجلسات + عزل serviceKey/userId + idempotency.
 * يتطلب DATABASE_URL وقاعدة متزامنة مع schema.
 *
 * التشغيل: npx tsx scripts/test-conversation-engine.ts
 */
import { prisma } from "@/lib/prisma";
import {
  appendMessage,
  ConversationEngineError,
  getConversationContext,
  linkGenerationJob,
  listConversations,
  renameConversation,
} from "@/lib/modules/conversations/engine";
import { generateConversationTitle } from "@/lib/modules/conversations/titles";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

async function ensureUser(id: string, email: string) {
  return prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      name: `Test ${id}`,
      email,
      passwordHash: "clerk:no-password",
      role: "LAWYER",
    },
  });
}

async function main() {
  console.log("🧪 اختبار محرك جلسات حكيم (المرحلة 2)");
  console.log("=".repeat(50));

  // عناوين
  const t1 = generateConversationTitle(
    "لدي عقد توريد أجهزة مع منشأة رياضية وأحتاج مراجعة بنود المسؤولية",
    "ask"
  );
  check(/\p{L}/u.test(t1) && t1.split(/\s+/).length >= 4 && t1.length < 200, `توليد عنوان قصير مفيد (${t1})`);
  check(
    generateConversationTitle("!!", "ask") === "جلسة جديدة",
    "عنوان احتياطي عند النص الضعيف"
  );

  const userA = "conv-test-user-a";
  const userB = "conv-test-user-b";
  await ensureUser(userA, "conv-a@test.local");
  await ensureUser(userB, "conv-b@test.local");

  // تنظيف بقايا سابقة
  await prisma.chatConversation.deleteMany({
    where: { userId: { in: [userA, userB] } },
  });

  // إنشاء قضية معاون للاختبار
  const jaCase = await prisma.judicialWorkCase.create({
    data: {
      ownerId: userA,
      subject: "قضية اختبار جلسات",
      jurisdiction: "commercial",
    },
    select: { id: true },
  });

  // إنشاء جلسة اسأل مع أول رسالة
  const created = await appendMessage({
    userId: userA,
    serviceKey: "ask",
    role: "user",
    content: "ما حكم فسخ عقد توريد عند التأخر؟",
    mode: "ask",
    clientRequestId: "req-ask-1",
  });
  check(created.created === true, "إنشاء جلسة اسأل مع أول رسالة");
  check(created.sequence === 1, "sequence أول رسالة = 1");

  // idempotency
  const dup = await appendMessage({
    userId: userA,
    serviceKey: "ask",
    conversationId: created.conversationId,
    role: "user",
    content: "ما حكم فسخ عقد توريد عند التأخر؟",
    clientRequestId: "req-ask-1",
  });
  check(dup.deduped === true && dup.messageId === created.messageId, "منع تكرار clientRequestId");

  // رد مساعد + مصادر
  const assistant = await appendMessage({
    userId: userA,
    serviceKey: "ask",
    conversationId: created.conversationId,
    role: "assistant",
    content: "وفق المواد المسترجعة يمكن النظر في الشرط الجزائي…",
    mode: "ask",
    clientRequestId: "req-ask-1-assistant",
    retrievedSources: [
      {
        kind: "article",
        id: "art-1",
        systemName: "نظام المعاملات المدنية",
        articleNumber: 1,
        quote: "نص تجريبي",
      },
    ],
  });
  check(assistant.sequence === 2, "تسلسل رسالة المساعد");

  const ctx = await getConversationContext({
    userId: userA,
    conversationId: created.conversationId,
    serviceKey: "ask",
  });
  check(ctx.messages.length === 2, "استعادة رسالتين");
  check(
    Array.isArray(ctx.messages[1]?.retrievedSources) &&
      (ctx.messages[1].retrievedSources as unknown[]).length === 1,
    "استعادة retrievedSources مع الرد"
  );

  // عزل الخدمة: جلسة ask لا تُفتح كـ judicial-assistant
  let serviceMismatch = false;
  try {
    await getConversationContext({
      userId: userA,
      conversationId: created.conversationId,
      serviceKey: "judicial-assistant",
    });
  } catch (e) {
    serviceMismatch =
      e instanceof ConversationEngineError &&
      (e.code === "SERVICE_MISMATCH" || e.code === "NOT_FOUND");
  }
  check(serviceMismatch, "رفض استعادة جلسة ask بـ serviceKey خاطئ");

  // جلسة معاون منفصلة
  const ja = await appendMessage({
    userId: userA,
    serviceKey: "judicial-assistant",
    role: "user",
    content: "لخّص ملف القضية",
    mode: "JS-001",
    judicialCaseId: jaCase.id,
    clientRequestId: "req-ja-1",
  });
  check(ja.created === true, "إنشاء جلسة معاون مرتبطة بقضية");

  const askList = await listConversations({ userId: userA, serviceKey: "ask" });
  const jaList = await listConversations({
    userId: userA,
    serviceKey: "judicial-assistant",
  });
  check(
    askList.items.length === 1 && !askList.items.some((i) => i.id === ja.conversationId),
    "قائمة ask لا تعرض جلسات المعاون"
  );
  check(
    jaList.items.length === 1 && jaList.items[0].judicialCaseId === jaCase.id,
    "قائمة المعاون تعرض جلستها فقط مع judicialCaseId"
  );

  // عزل المستخدمين
  let foreignDenied = false;
  try {
    await getConversationContext({
      userId: userB,
      conversationId: created.conversationId,
      serviceKey: "ask",
    });
  } catch (e) {
    foreignDenied = e instanceof ConversationEngineError && e.code === "NOT_FOUND";
  }
  check(foreignDenied, "مستخدم آخر لا يستعيد جلسة غيره");

  // إعادة تسمية لا تغيّر generatedTitle
  const before = await prisma.chatConversation.findUniqueOrThrow({
    where: { id: created.conversationId },
  });
  await renameConversation({
    userId: userA,
    conversationId: created.conversationId,
    serviceKey: "ask",
    title: "فسخ عقد توريد",
  });
  const after = await prisma.chatConversation.findUniqueOrThrow({
    where: { id: created.conversationId },
  });
  check(after.title === "فسخ عقد توريد", "إعادة التسمية تحدّث title");
  check(after.generatedTitle === before.generatedTitle, "generatedTitle لا يتغير");

  // ربط generation_jobs
  const jobRows = (await prisma.$queryRawUnsafe(
    `INSERT INTO "generation_jobs"("owner_id","kind","title","status")
     VALUES ($1,'hakeem-ask','اختبار', 'running') RETURNING "id"::text AS id`,
    userA
  )) as Array<{ id: string }>;
  const jobId = jobRows[0]?.id;
  check(Boolean(jobId), "إنشاء generation_job للاختبار");
  if (jobId) {
    const linked = await linkGenerationJob({
      jobId,
      ownerId: userA,
      conversationId: created.conversationId,
      messageId: created.messageId,
      serviceKey: "ask",
      clientRequestId: "req-ask-1",
    });
    check(linked, "ربط المهمة بالمحادثة والرسالة");
    const job = (await prisma.$queryRawUnsafe(
      `SELECT conversation_id, message_id, service_key FROM generation_jobs WHERE id=$1::uuid`,
      jobId
    )) as Array<{ conversation_id: string; message_id: string; service_key: string }>;
    check(
      job[0]?.conversation_id === created.conversationId &&
        job[0]?.message_id === created.messageId &&
        job[0]?.service_key === "ask",
      "أعمدة generation_jobs معبأة بشكل صحيح"
    );
  }

  // لا DEFAULT على service_key — محاولة insert بلا service_key تفشل
  let noDefault = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "chat_conversations"("id","title","user_id","mode","status","updated_at")
       VALUES ('x-no-service','t',$1,'ask','active',NOW())`,
      userA
    );
  } catch {
    noDefault = true;
  }
  check(noDefault, "service_key إلزامي بلا DEFAULT في القاعدة");

  // تنظيف
  await prisma.chatConversation.deleteMany({ where: { userId: { in: [userA, userB] } } });
  await prisma.judicialWorkCase.deleteMany({ where: { id: jaCase.id } });
  await prisma.$executeRawUnsafe(`DELETE FROM generation_jobs WHERE owner_id = $1`, userA);
  await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });

  console.log("-".repeat(50));
  console.log(`النتيجة: ${passed} ناجح / ${failed} فاشل`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error("💥 فشل الاختبار:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
