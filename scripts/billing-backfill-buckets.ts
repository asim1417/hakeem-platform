// Backfill الـBuckets للأرصدة القائمة — HKM-BILLING-UX-001 (مراجعة الصحّة، أولوية 1).
// المستخدمون الحاليون لديهم رصيد حساب بلا buckets؛ ننشئ bucket LEGACY_MIGRATION بمقدار
// (balance − sum(buckets الحالية)) حتى يصحّ التطابق sum(buckets)=balance قبل تفعيل الإنفاذ.
// idempotent: يعالج الفرق فقط. يتطلب DATABASE_URL؛ بدونه SKIP. تشغيل: npm run billing:backfill-buckets

import { randomBytes } from "crypto";

async function main(): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
  } catch {
    console.log("SKIP :: لا قاعدة بيانات — يلزم staging/production.");
    process.exit(0);
  }

  const rows = await prisma.$queryRawUnsafe<
    { userId: string; balance: bigint | number; bucketSum: bigint | number }[]
  >(
    `SELECT a."userId" AS "userId",
            a."balanceMilliUnits" AS balance,
            COALESCE(b.sum, 0) AS "bucketSum"
       FROM "usage_credit_accounts" a
       LEFT JOIN (
         SELECT "userId", SUM("remainingMilliUnits") AS sum
           FROM "usage_credit_buckets"
          WHERE status = 'active'
          GROUP BY "userId"
       ) b ON b."userId" = a."userId"
      WHERE a."balanceMilliUnits" > COALESCE(b.sum, 0)`
  );

  let created = 0;
  for (const r of rows) {
    const diff = Number(r.balance) - Number(r.bucketSum);
    if (diff <= 0) continue;
    // idempotent لكل مستخدم: لا نكرّر إن وُجد bucket ترحيل سابق يغطّي الفرق.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "usage_credit_buckets"
        (id, "userId", "sourceType", "sourceReferenceId", "grantedMilliUnits",
         "remainingMilliUnits", status, "startsAt", "expiresAt", priority)
       VALUES ($1,$2,'LEGACY_MIGRATION','backfill',$3,$3,'active',NOW(),NULL,50)`,
      `ucb_${randomBytes(12).toString("hex")}`,
      r.userId,
      diff
    );
    created++;
  }
  console.log(`[backfill-buckets] أُنشئ ${created} bucket ترحيل لموازنة الأرصدة القائمة.`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error("[backfill-buckets] فشل:", e);
  process.exit(1);
});
