/**
 * يفعّل امتداد pg_trgm وينشئ فهارس GIN trigram لتسريع البحث النصّي (ILIKE %term%)
 * على الأحكام والمبادئ والمواد. آمن وidempotent (IF NOT EXISTS).
 * التشغيل: npm run db:search-indexes
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATEMENTS: string[] = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  // الأحكام القضائية
  `CREATE INDEX IF NOT EXISTS idx_trgm_jc_title ON "judicial_cases" USING gin ("judgmentTitle" gin_trgm_ops);`,
  `CREATE INDEX IF NOT EXISTS idx_trgm_jc_text  ON "judicial_cases" USING gin ("judgmentText" gin_trgm_ops);`,
  // المبادئ القضائية
  `CREATE INDEX IF NOT EXISTS idx_trgm_jp_title ON "judicial_principles" USING gin ("title" gin_trgm_ops);`,
  `CREATE INDEX IF NOT EXISTS idx_trgm_jp_text  ON "judicial_principles" USING gin ("principleText" gin_trgm_ops);`,
  // المواد النظامية
  `CREATE INDEX IF NOT EXISTS idx_trgm_la_title ON "legal_articles" USING gin ("title" gin_trgm_ops);`,
  `CREATE INDEX IF NOT EXISTS idx_trgm_la_text  ON "legal_articles" USING gin ("content" gin_trgm_ops);`,
];

async function main() {
  console.log("⚙️  تفعيل pg_trgm وإنشاء فهارس البحث…");
  for (const sql of STATEMENTS) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("  ✅ " + sql.replace(/\s+/g, " ").slice(0, 70));
    } catch (e) {
      console.log("  ⚠️  تعذّر: " + sql.slice(0, 60) + " — " + (e instanceof Error ? e.message.split("\n")[0] : e));
    }
  }
  const idx = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT count(*)::bigint AS count FROM pg_indexes WHERE indexname LIKE 'idx_trgm_%';`
  );
  console.log(`\n✅ فهارس trigram الموجودة: ${idx[0]?.count ?? 0}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
