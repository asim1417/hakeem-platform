/**
 * تطبيق هجرة onboarding/credits/referrals على قاعدة البيانات.
 * التشغيل: npx tsx scripts/apply-onboarding-credits.ts
 */
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const { prisma } = await import("../lib/prisma");
  const sqlPath = join(
    process.cwd(),
    "prisma/migrations/20260718180000_onboarding_credits_referrals/migration.sql"
  );
  const sql = readFileSync(sqlPath, "utf8");
  // نفّذ جملًا مفصولة بـ ; مع تجاهل التعليقات الفارغة
  const statements = sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("OK:", stmt.slice(0, 60).replace(/\s+/g, " "), "…");
  }
  console.log("apply-onboarding-credits: done");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
