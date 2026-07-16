// تشخيص للقراءة فقط: عدد المواد لكل نظام في النواة. لا يعدّل شيئًا (SELECT COUNT فقط).
import { prisma } from "@/lib/prisma";

const TARGETS = ["الأحوال الشخصية", "الإجراءات الجزائية", "المعاملات المدنية"];

async function countFor(name: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
    `SELECT COUNT(*)::bigint AS c
     FROM legal_articles a
     LEFT JOIN legal_systems ls ON a."legalSystemId" = ls.id
     WHERE ls.name ILIKE $1 OR a."lawName" ILIKE $1`,
    `%${name}%`
  );
  return Number(rows[0]?.c ?? 0);
}

async function main() {
  const total = await prisma.legalArticle.count().catch(() => 0);
  console.log(`إجمالي المواد في النواة: ${total.toLocaleString("ar-SA")}\n`);

  console.log("── الأنظمة المطلوبة ──");
  for (const t of TARGETS) {
    const c = await countFor(t);
    console.log(`${c === 0 ? "✗" : "✓"} ${t}\t= ${c.toLocaleString("ar-SA")}`);
  }

  console.log("\n── أعلى ٣٠ نظامًا بعدد المواد (COALESCE(اسم النظام, lawName)) ──");
  const rows = await prisma.$queryRawUnsafe<Array<{ system: string | null; c: bigint }>>(
    `SELECT COALESCE(ls.name, a."lawName") AS system, COUNT(*)::bigint AS c
     FROM legal_articles a
     LEFT JOIN legal_systems ls ON a."legalSystemId" = ls.id
     GROUP BY COALESCE(ls.name, a."lawName")
     ORDER BY c DESC
     LIMIT 30`
  );
  for (const r of rows) console.log(`  ${Number(r.c).toLocaleString("ar-SA")}\t${r.system ?? "(بلا اسم)"}`);

  // فحص إضافي: هل يوجد أي نظام باسم يحوي «أحوال» أو «نكاح» أو «أسرة»؟
  console.log("\n── بحث عن أنظمة أسرية (أحوال/أسرة/نكاح/زواج) ──");
  const fam = await prisma.$queryRawUnsafe<Array<{ name: string; c: bigint }>>(
    `SELECT ls.name, COUNT(a.id)::bigint AS c
     FROM legal_systems ls LEFT JOIN legal_articles a ON a."legalSystemId" = ls.id
     WHERE ls.name ILIKE '%أحوال%' OR ls.name ILIKE '%أسرة%' OR ls.name ILIKE '%نكاح%' OR ls.name ILIKE '%زواج%' OR ls.name ILIKE '%الاسرة%'
     GROUP BY ls.name ORDER BY c DESC`
  );
  if (!fam.length) console.log("  (لا يوجد أي نظام أسريّ مسجَّل في legal_systems)");
  for (const r of fam) console.log(`  ${Number(r.c).toLocaleString("ar-SA")}\t${r.name}`);

  await prisma.$disconnect().catch(() => {});
}
main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
