/**
 * يضيف عمود username إلى جدول users إن لم يكن موجودًا.
 * التشغيل: npx tsx scripts/apply-username-column.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "username" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
  `);
  console.log("apply-username-column: OK");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
