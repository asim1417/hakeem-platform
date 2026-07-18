/**
 * تطبيق هجرات onboarding/credits/OTP/avatar على قاعدة البيانات.
 * التشغيل: npx tsx scripts/apply-onboarding-credits.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

async function runSqlFile(prisma: { $executeRawUnsafe: (q: string, ...a: unknown[]) => Promise<unknown> }, rel: string) {
  const sqlPath = join(process.cwd(), rel);
  const sql = readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("OK:", stmt.slice(0, 70).replace(/\s+/g, " "), "…");
  }
}

async function main() {
  const { prisma } = await import("../lib/prisma");
  await runSqlFile(prisma, "prisma/migrations/20260718180000_onboarding_credits_referrals/migration.sql");
  await runSqlFile(prisma, "prisma/migrations/20260718190000_otp_avatar_profile_ext/migration.sql");
  console.log("apply-onboarding-credits: done");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
