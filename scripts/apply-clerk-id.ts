/** تطبيق عمود clerk_id — npx tsx scripts/apply-clerk-id.ts */
import { readFileSync } from "fs";
import { join } from "path";

async function main() {
  const { prisma } = await import("../lib/prisma");
  const sql = readFileSync(
    join(process.cwd(), "prisma/migrations/20260719120000_add_clerk_id/migration.sql"),
    "utf8"
  );
  for (const stmt of sql
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean)) {
    await prisma.$executeRawUnsafe(stmt);
    console.log("OK:", stmt.slice(0, 60));
  }
  await prisma.$disconnect();
  console.log("apply-clerk-id: done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
