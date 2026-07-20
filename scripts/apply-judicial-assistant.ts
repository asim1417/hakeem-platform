// يطبّق تغييرات المعاون القضائي (المرحلة 1ب) على القاعدة الحيّة بجُمَلٍ idempotent —
// بديلٌ آمن عن `prisma migrate deploy` (البناء لا يهاجر). آمنٌ لإعادة التشغيل، لا يحذف شيئًا.
//   1) إضافة دور JUDGE إلى نوع enum "UserRole".
//   2) إنشاء جدول judicial_analyses (حفظ مخرجات JS-00x) + فهرسه.
// شغّله مرّة على كلّ بيئة: `npm run db:judicial` (بعد ضبط DATABASE_URL للبيئة الصحيحة).
import { prisma } from "@/lib/prisma";

const STATEMENTS = [
  `ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'JUDGE'`,
  `CREATE TABLE IF NOT EXISTS "judicial_analyses" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "case_ref"    TEXT NOT NULL,
    "case_number" TEXT NOT NULL,
    "service_id"  TEXT NOT NULL,
    "blocked"     BOOLEAN NOT NULL DEFAULT FALSE,
    "payload"     JSONB NOT NULL,
    "actor_id"    UUID,
    "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "judicial_analyses_case_ref_created_at_idx" ON "judicial_analyses"("case_ref", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "judicial_work_cases" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"        TEXT NOT NULL,
    "case_number"     TEXT,
    "court"           TEXT,
    "circuit"         TEXT,
    "jurisdiction"    TEXT NOT NULL DEFAULT 'general',
    "subject"         TEXT NOT NULL,
    "stage"           TEXT NOT NULL DEFAULT 'active',
    "confidentiality" TEXT NOT NULL DEFAULT 'normal',
    "attachments"     JSONB NOT NULL DEFAULT '[]',
    "structured"      JSONB NOT NULL DEFAULT '{}',
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "judicial_work_cases_owner_id_created_at_idx" ON "judicial_work_cases"("owner_id", "created_at")`,
];

async function main() {
  for (const sql of STATEMENTS) {
    // ADD VALUE لا يعمل داخل معاملة؛ executeRawUnsafe يشغّل كلّ جملة مستقلّة.
    await prisma.$executeRawUnsafe(sql);
    console.log(`✓ ${sql.replace(/\s+/g, " ").slice(0, 72)}…`);
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c FROM judicial_analyses`
  );
  console.log(`اكتمل تطبيق هجرة المعاون القضائي. سجلّات تحليلٍ حاليّة: ${Number(rows[0]?.c ?? 0).toLocaleString("ar-SA")}`);
  await prisma.$disconnect().catch(() => {});
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
