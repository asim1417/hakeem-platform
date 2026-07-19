// ─────────────────────────────────────────────────────────────────────────────
// هجرةٌ ذاتيّة آمنة — تُنشئ جداول المعاون القضائي على القاعدة الحيّة عند أوّل استخدام،
// بجُمَل idempotent (IF NOT EXISTS) لأنّ بناء Vercel لا يهاجر. تُشغَّل مرّةً لكلّ نسخة خادم
// (memoized)، وتسقط سقوطًا آمنًا: إن فشلت تُعاد المحاولة لاحقًا دون كسر الطلب.
// بديلٌ عن `npm run db:judicial` حين لا يمكن تشغيله يدويًّا.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";

const DDL = [
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
];

let ready: Promise<boolean> | null = null;

/**
 * يضمن وجود جداول المعاون القضائي. يُشغَّل مرّةً (memoized) لكلّ نسخة خادم؛ عند الفشل يُصفَّر
 * كي يُعاد لاحقًا. لا يمسّ enum الأدوار (JUDGE غير لازم — الصلاحية على الخريطة الثابتة).
 */
export async function ensureJudicialSchema(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const sql of DDL) await prisma.$executeRawUnsafe(sql);
        return true;
      } catch {
        ready = null; // اسمح بإعادة المحاولة في الطلب التالي
        return false;
      }
    })();
  }
  return ready;
}
