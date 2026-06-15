/* أداة فحص قاعدة البيانات — تُظهر كل الجداول وعدد صفوف الجداول المهمة.
   تُستخدم لمعرفة أين توجد بيانات الأحكام. التشغيل عبر workflow db-inspect. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 فحص قاعدة البيانات");
  console.log("=".repeat(50));

  // كل الجداول في المخططات غير النظامية
  const tables = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
       AND table_type = 'BASE TABLE'
     ORDER BY table_schema, table_name`
  );

  console.log(`\n📋 عدد الجداول الموجودة: ${tables.length}`);
  if (tables.length === 0) {
    console.log("  (لا توجد جداول إطلاقاً — القاعدة فارغة تماماً)");
  } else {
    for (const t of tables) console.log(`  • ${t.table_schema}.${t.table_name}`);
  }

  // عدّ صفوف الجداول المهمة إن وُجدت
  const present = new Set(tables.map((t) => `${t.table_schema}.${t.table_name}`));
  const keyTables = [
    "public.judicial_cases",
    "public.legal_articles",
    "public.legal_systems",
    "public.users",
    "public.judicial_principles",
    "public.legal_article_case_links",
  ];

  console.log(`\n📊 أعداد الصفوف:`);
  let foundAny = false;
  for (const tbl of keyTables) {
    if (!present.has(tbl)) {
      console.log(`  ✗ ${tbl} — غير موجود`);
      continue;
    }
    foundAny = true;
    try {
      const r = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT count(*)::bigint AS count FROM ${tbl}`);
      console.log(`  ✓ ${tbl} — ${r[0].count.toString()} صف`);
    } catch (e) {
      console.log(`  ⚠ ${tbl} — تعذّر العدّ: ${(e as Error).message}`);
    }
  }

  console.log("\n" + "=".repeat(50));
  if (!foundAny) {
    console.log("الخلاصة: لا يوجد أي جدول من جداول منصة حكيم — هذه القاعدة ليست قاعدة الأحكام.");
  } else if (present.has("public.judicial_cases")) {
    console.log("الخلاصة: جدول الأحكام موجود — راجع عدد صفوفه أعلاه.");
  } else {
    console.log("الخلاصة: بعض جداول المنصة موجودة لكن جدول الأحكام غير موجود.");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("فشل الفحص:", e);
  process.exit(1);
});
