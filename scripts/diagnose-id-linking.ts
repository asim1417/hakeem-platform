/**
 * diagnose-id-linking.ts — تشخيص المرحلة ٢ (قراءة فقط، لا كتابة).
 *
 * يقيس صلابة ربط المواد بالأنظمة بالمعرّف الثابت بدل النص:
 *  - عدد المواد التي legalSystemId = null (المتوقّع 0 — مادة بلا نظام).
 *  - عدد قيم lawName المتميّزة التي لا تطابق أي legal_systems.name بالضبط (قائمة).
 *  - نسبة التغطية بالمعرّف (المواد ذات legalSystemId صحيح / الإجمالي).
 *  - تباين الاسم: مواد legalSystemId يشير لنظام اسمه ≠ lawName (عرض فقط، لا يكسر الربط).
 * لا يطبع أسرارًا (بصمة المضيف فقط). لا يكتب أي صفّ.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

async function main() {
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)}`);
  console.log("=".repeat(64));

  const [totalArticles, totalSystems, nullSystemId] = await Promise.all([
    prisma.legalArticle.count(),
    prisma.legalSystem.count(),
    prisma.legalArticle.count({ where: { legalSystemId: null } })
  ]);

  console.log(`إجمالي المواد:        ${totalArticles.toLocaleString("en")}`);
  console.log(`إجمالي الأنظمة:       ${totalSystems.toLocaleString("en")}`);
  console.log(`مواد بلا legalSystemId: ${nullSystemId.toLocaleString("en")} ${nullSystemId === 0 ? "✅" : "🔴"}`);

  // أسماء الأنظمة الرسمية (المصدر) مقابل قيم lawName في المواد.
  const systems = await prisma.legalSystem.findMany({ select: { name: true } });
  const systemNames = new Set(systems.map((s) => s.name));

  const lawNameGroups = await prisma.legalArticle.groupBy({
    by: ["lawName"],
    _count: { _all: true }
  });
  const unmatched = lawNameGroups
    .filter((g) => !systemNames.has(g.lawName))
    .sort((a, b) => b._count._all - a._count._all);

  console.log(`\nقيم lawName المتميّزة:   ${lawNameGroups.length.toLocaleString("en")}`);
  console.log(`منها لا تطابق أي نظام:  ${unmatched.length.toLocaleString("en")} ${unmatched.length === 0 ? "✅" : "⚠️"}`);
  if (unmatched.length) {
    console.log("  أكثر عشرة غير مطابقة (lawName × عدد المواد):");
    for (const u of unmatched.slice(0, 10)) {
      console.log(`   • «${u.lawName}» — ${u._count._all} مادة`);
    }
  }

  // تباين الاسم: المادة مرتبطة بـid لكن lawName ≠ اسم النظام المرتبط (عرض فقط).
  const linked = await prisma.legalArticle.findMany({
    where: { legalSystemId: { not: null } },
    select: { lawName: true, legalSystem: { select: { name: true } } },
    take: 20000
  });
  const nameDrift = linked.filter((a) => a.legalSystem && a.legalSystem.name !== a.lawName).length;
  console.log(`\nتباين الاسم (lawName ≠ اسم النظام المرتبط): ${nameDrift.toLocaleString("en")}`);
  console.log("  (لا يكسر الربط بالمعرّف؛ مؤشّر لتنظيف العرض فقط.)");

  const coverage = totalArticles ? (((totalArticles - nullSystemId) / totalArticles) * 100).toFixed(2) : "0";
  console.log(`\nتغطية الربط بالمعرّف: ${coverage}%`);
  console.log("=".repeat(64));
  console.log(
    nullSystemId === 0
      ? "✅ تغطية كاملة بالمعرّف — آمن لاحقًا جعل legalSystemId مطلوبًا (migration منفصلة)."
      : "🔴 توجد مواد بلا نظام — لا تجعل legalSystemId مطلوبًا قبل معالجتها."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
