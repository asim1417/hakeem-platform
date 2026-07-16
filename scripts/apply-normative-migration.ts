// يطبّق أعمدة تفكيك المعيار (norm_*) + الفهرس على القاعدة الحيّة بجُمَلٍ idempotent
// (IF NOT EXISTS) — بديلٌ آمن عن `prisma migrate deploy` (لا يعتمد حالة _prisma_migrations).
// آمن لإعادة التشغيل تمامًا. لا يحذف شيئًا. لا يمسّ بيانات قائمة.
import { prisma } from "@/lib/prisma";

const STATEMENTS = [
  `ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_addressee" TEXT`,
  `ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_modality"  TEXT`,
  `ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_condition" TEXT`,
  `ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_effect"    TEXT`,
  `ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_source"    TEXT`,
  `CREATE INDEX IF NOT EXISTS "legal_articles_norm_modality_norm_addressee_idx" ON "legal_articles"("norm_modality", "norm_addressee")`,
];

async function main() {
  for (const sql of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${sql.slice(0, 70)}…`);
  }
  // تحقّق: العمود موجود الآن.
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM legal_articles WHERE "norm_modality" IS NULL`
  );
  console.log(`اكتمل تطبيق الهجرة. مواد غير مُوسَّمة بعدُ: ${Number(rows[0]?.c ?? 0).toLocaleString("ar-SA")}`);
  await prisma.$disconnect().catch(() => {});
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
