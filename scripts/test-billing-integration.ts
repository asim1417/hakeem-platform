// اختبارات تكامل الفوترة على مستوى القاعدة — HKM-BILLING-UX-001 (§17).
// تتطلب DATABASE_URL حقيقيًا (staging). بدون قاعدة → SKIP (خروج 0) بلا فشل.
// تشغيل: npm run test:billing-integration
//
// تغطّي ثوابت القاعدة الحرجة (لا تعتمد على وحدات server-only):
// - إنشاء المخطط idempotent
// - تفرّد webhook (provider, providerEventId) → منع تكرار
// - عدّاد الفواتير الذرّي المتزايد
// - دفتر النقاط append-only (Trigger يمنع UPDATE) — إن وُجدت جداول v2

import { randomBytes } from "crypto";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  // فحص توفّر القاعدة.
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch {
    console.log("SKIP :: لا قاعدة بيانات متاحة — يلزم staging.");
    process.exit(0);
  }

  const { ensureBillingSchema } = await import("@/lib/modules/billing/ensure-billing-schema");
  const ok = await ensureBillingSchema();
  T("ensureBillingSchema يعيد true", ok === true);
  T("ensureBillingSchema idempotent (تكرار آمن)", (await ensureBillingSchema()) === true);

  // تفرّد webhook.
  const evId = `evt_${randomBytes(8).toString("hex")}`;
  const wid1 = `whk_${randomBytes(8).toString("hex")}`;
  const wid2 = `whk_${randomBytes(8).toString("hex")}`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "billing_webhook_events" ("id","provider","provider_event_id","payload","status")
     VALUES ($1,'moyasar',$2,'{}'::jsonb,'RECEIVED')`,
    wid1,
    evId
  );
  let dupBlocked = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "billing_webhook_events" ("id","provider","provider_event_id","payload","status")
       VALUES ($1,'moyasar',$2,'{}'::jsonb,'RECEIVED')`,
      wid2,
      evId
    );
  } catch {
    dupBlocked = true;
  }
  T("webhook مكرر (provider,eventId) محجوب بالتفرّد", dupBlocked);

  // عدّاد الفواتير الذرّي.
  const year = 4000 + Math.floor(Number(`0x${randomBytes(1).toString("hex")}`)); // سنة اختبار معزولة
  const seq1 = (await prisma.$queryRawUnsafe<{ last_seq: number }[]>(
    `INSERT INTO "billing_invoice_counters" ("year","last_seq") VALUES ($1,1)
     ON CONFLICT ("year") DO UPDATE SET "last_seq" = "billing_invoice_counters"."last_seq" + 1
     RETURNING "last_seq"`,
    year
  ))[0].last_seq;
  const seq2 = (await prisma.$queryRawUnsafe<{ last_seq: number }[]>(
    `INSERT INTO "billing_invoice_counters" ("year","last_seq") VALUES ($1,1)
     ON CONFLICT ("year") DO UPDATE SET "last_seq" = "billing_invoice_counters"."last_seq" + 1
     RETURNING "last_seq"`,
    year
  ))[0].last_seq;
  T("عدّاد الفواتير يتزايد ذرّيًا", Number(seq2) === Number(seq1) + 1);
  await prisma.$executeRawUnsafe(`DELETE FROM "billing_invoice_counters" WHERE "year" = $1`, year);

  // دفتر append-only (إن وُجد جدول v2).
  try {
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" LIMIT 1`
    );
    if (rows[0]) {
      let mutationBlocked = false;
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "usage_credit_ledger" SET "source" = 'tamper' WHERE id = $1`,
          rows[0].id
        );
      } catch {
        mutationBlocked = true;
      }
      T("دفتر النقاط append-only (UPDATE محجوب)", mutationBlocked);
    } else {
      console.log("SKIP :: لا صفوف في usage_credit_ledger لاختبار الـTrigger.");
    }
  } catch {
    console.log("SKIP :: جداول usage_credits_v2 غير مطبَّقة.");
  }

  console.log(`\n${pass} PASS / ${fail} FAIL`);
  await prisma.$disconnect();
  if (fail) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error("خطأ:", e);
  process.exit(1);
});
