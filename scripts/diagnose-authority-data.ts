/**
 * diagnose-authority-data.ts — تشخيص قرائي: ما البيانات المتوفّرة فعلاً لبنود «الحافة»
 * المحجوبة (Citator/السلطة/السلوك)؟ لا نفترض — نعدّ ونعيّن.
 *
 *  - حالة المادة + التعديلات + النسخ (Citator: سارية/معدّلة/منسوخة).
 *  - روابط المادة↔الحكم (إشارة سلطة: عدد الاستشهادات).
 *  - الأحكام/المبادئ (كوربوس)، علاقات الرسم المعرفي، سجلّ البحث (سلوك).
 *
 * قراءة فقط. يُفضّل NEON_DATABASE_URL. التشغيل: npm run diagnose:authority
 */
import { prisma } from "@/lib/prisma";

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.log(`  ⚠ ${label}: تعذّر (${e instanceof Error ? e.message.slice(0, 80) : "خطأ"})`);
    return null;
  }
}

function bar(label: string, n: number | null) {
  console.log(`  ${label.padEnd(42, " ")} ${n === null ? "—" : n.toLocaleString("en-US")}`);
}

async function main() {
  console.log("═".repeat(72));
  console.log("تشخيص بيانات السلطة/الـCitator/السلوك — قراءة فقط");
  console.log("═".repeat(72));

  // ① المواد + الحالة (أساس شارة Citator)
  console.log("\n① المواد وحالتها:");
  const articles = await safe("count", () => prisma.legalArticle.count());
  bar("إجمالي المواد", articles);
  const statusGroups = await safe("status groupBy", () =>
    prisma.legalArticle.groupBy({ by: ["status"], _count: { _all: true } })
  );
  if (statusGroups) {
    for (const g of statusGroups.sort((a, b) => b._count._all - a._count._all)) {
      bar(`  status = «${g.status}»`, g._count._all);
    }
  }
  const withDecree = await safe("royalDecree", () => prisma.legalArticle.count({ where: { NOT: { royalDecree: null } } }));
  bar("مواد لها مرسوم ملكي (royalDecree)", withDecree);
  const withEffective = await safe("effectiveFrom", () => prisma.legalArticle.count({ where: { NOT: { effectiveFrom: null } } }));
  bar("مواد لها تاريخ نفاذ (effectiveFrom)", withEffective);

  // ② التعديلات + النسخ (Citator: هل المادة معدّلة/منسوخة؟)
  console.log("\n② التعديلات والنسخ (Citator):");
  const amendCount = await safe("amend count", () => prisma.articleAmendment.count());
  bar("سجلّات ArticleAmendment", amendCount);
  const amendedArticles = await safe("amend distinct", () =>
    prisma.articleAmendment.findMany({ distinct: ["articleId"], select: { articleId: true } }).then((r) => r.length)
  );
  bar("مواد لها تعديل (distinct)", amendedArticles);
  const versionCount = await safe("version count", () => prisma.articleVersion.count());
  bar("سجلّات ArticleVersion", versionCount);
  const superseded = await safe("superseded", () => prisma.articleVersion.count({ where: { NOT: { effectiveTo: null } } }));
  bar("نسخ مُتجاوَزة (effectiveTo != null)", superseded);

  // ③ روابط المادة↔الحكم (إشارة السلطة = عدد الاستشهادات)
  console.log("\n③ روابط المادة↔الحكم (السلطة):");
  const linkCount = await safe("link count", () => prisma.legalArticleCaseLink.count());
  bar("سجلّات LegalArticleCaseLink", linkCount);
  const linkedArticles = await safe("linked articles", () =>
    prisma.legalArticleCaseLink.findMany({ distinct: ["articleId"], select: { articleId: true } }).then((r) => r.length)
  );
  bar("مواد مُستشهَد بها (distinct)", linkedArticles);
  const topCited = await safe("top cited", () =>
    prisma.legalArticleCaseLink.groupBy({ by: ["articleId"], _count: { articleId: true }, orderBy: { _count: { articleId: "desc" } }, take: 5 })
  );
  if (topCited && topCited.length) {
    console.log("  أكثر 5 مواد استشهاداً:");
    for (const t of topCited) bar(`    article ${t.articleId.slice(0, 10)}…`, t._count.articleId);
  }

  // ④ الأحكام/المبادئ + الرسم المعرفي + السلوك
  console.log("\n④ الكوربوس والرسم والسلوك:");
  bar("JudicialCase (أحكام)", await safe("cases", () => prisma.judicialCase.count()));
  bar("JudicialPrinciple (مبادئ)", await safe("principles", () => prisma.judicialPrinciple.count()));
  bar("LegalRelation (رسم معرفي)", await safe("relations", () => prisma.legalRelation.count()));
  bar("SearchLog (سلوك البحث)", await safe("searchlog", () => prisma.searchLog.count()));

  // ⑤ تركيب الرسم المعرفي (هل توجد روابط مادة↔مادة تغذّي «مواد ذات صلة»؟)
  console.log("\n⑤ تركيب الرسم المعرفي (نوع المصدر↔الهدف):");
  const composition = await safe("relation composition", () =>
    prisma.legalRelation.groupBy({ by: ["sourceType", "targetType"], _count: { _all: true } })
  );
  if (composition) {
    for (const g of composition.sort((a, b) => b._count._all - a._count._all)) {
      bar(`  ${g.sourceType} → ${g.targetType}`, g._count._all);
    }
    const artArt = composition.find((g) => g.sourceType === "article" && g.targetType === "article");
    console.log(`  ← «مواد ذات صلة» (مادة→مادة) ${artArt ? "متوفّرة ✓" : "غير مبذورة — شغّل thesaurus:article-relations"}`);
  }

  console.log("\n" + "═".repeat(72));
  console.log("الخلاصة: البنود التي بياناتها > 0 قابلة للبناء الآن؛ التي = 0 تنتظر استيراداً.");
  console.log("═".repeat(72));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("✗ فشل التشخيص:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
