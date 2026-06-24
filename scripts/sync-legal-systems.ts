/**
 * sync-legal-systems.ts — مزامنة جدول legal_systems وعدّاد المواد من legal_articles.
 * ──────────────────────────────────────────────────────────────────
 * يعالج ثغرة التقرير: تقادم legal_systems.articleCount بعد الاستيراد، وغياب صفوف الأنظمة.
 * لكل lawName في legal_articles: upsert صفّ نظام بعدد مواده وأغلب تصنيفاته شيوعاً.
 *
 * آمن: dry-run افتراضياً. للتطبيق: --apply. idempotent (upsert على name الفريد).
 * يُشغَّل بعد كل استيراد (import:hoqoqi / import:judgments).
 *
 * التشغيل:
 *   npm run sync:systems              # معاينة
 *   npm run sync:systems -- --apply   # تطبيق فعلي
 */
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`🔄 مزامنة legal_systems — الوضع: ${APPLY ? "تطبيق (--apply)" : "معاينة (dry-run)"}`);
  console.log("=".repeat(56));

  // عدد المواد لكل نظام
  const byLaw = await prisma.legalArticle
    .groupBy({ by: ["lawName"], _count: { _all: true } })
    .catch(() => [] as { lawName: string; _count: { _all: number } }[]);
  if (!byLaw.length) {
    console.error("❌ لا مواد في legal_articles (قاعدة بيانات غير متصلة أو فارغة).");
    return;
  }

  // أغلب تصنيف شيوعاً لكل نظام
  const byLawClass = await prisma.legalArticle
    .groupBy({ by: ["lawName", "classification"], _count: { _all: true } })
    .catch(() => [] as { lawName: string; classification: string | null; _count: { _all: number } }[]);
  const topClass = new Map<string, { c: string | null; n: number }>();
  for (const r of byLawClass) {
    if (!r.classification) continue;
    const cur = topClass.get(r.lawName);
    if (!cur || r._count._all > cur.n) topClass.set(r.lawName, { c: r.classification, n: r._count._all });
  }

  const existing = await prisma.legalSystem.findMany({ select: { name: true, articleCount: true } }).catch(() => []);
  const existingMap = new Map(existing.map((s) => [s.name, s.articleCount]));

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  console.log(`📖 أنظمة في المواد: ${byLaw.length} · صفوف legal_systems حالياً: ${existing.length}`);

  for (const { lawName, _count } of byLaw) {
    const count = _count._all;
    const classification = topClass.get(lawName)?.c ?? null;
    const prev = existingMap.get(lawName);
    if (prev === undefined) created++;
    else if (prev !== count) updated++;
    else unchanged++;

    if (APPLY) {
      await prisma.legalSystem.upsert({
        where: { name: lawName },
        create: { name: lawName, articleCount: count, classification },
        update: { articleCount: count, classification }
      });
    }
  }

  console.log("\n📊 الخطة:");
  console.log(`   أنظمة جديدة:     ${created}`);
  console.log(`   عدّاد مُحدَّث:     ${updated}`);
  console.log(`   بلا تغيير:        ${unchanged}`);

  if (!APPLY) {
    console.log("\n⚠️  معاينة فقط — لم يُكتب شيء. أعِد التشغيل بـ --apply للتطبيق.");
    return;
  }
  console.log(`\n✅ تمت المزامنة: ${created} إنشاء · ${updated} تحديث.`);
}

main()
  .catch((e) => {
    console.error("❌ خطأ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
