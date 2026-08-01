/**
 * إنشاء جدول generic_rate_limit_windows إن لم يوجد (idempotent).
 * تشغيل: npx tsx scripts/apply-generic-rate-limit-windows.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS generic_rate_limit_windows (
      id TEXT PRIMARY KEY,
      bucket_key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS generic_rate_limit_windows_bucket_window_uidx
      ON generic_rate_limit_windows (bucket_key, window_start);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS generic_rate_limit_windows_window_idx
      ON generic_rate_limit_windows (window_start);
  `);
  console.log("generic_rate_limit_windows جاهز.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
