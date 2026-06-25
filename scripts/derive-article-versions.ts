/**
 * derive-article-versions.ts — اشتقاق النسخة الأولى لكل مادة (المرحلة ٦).
 *
 * لكل مادة لا تملك أي نسخة في article_versions، يُنشئ نسخة v1 من النصّ الحالي:
 *   versionText = content، effectiveFrom = المادة.effectiveFrom، effectiveTo = null
 *   (النافذة حاليًا)، royalDecree = المادة.royalDecree، source = 'derived'.
 * لا يلمس legal_articles.content (توافق خلفي). idempotent: يتخطّى ما له نسخة.
 *
 * تشغيل (عبر workflow مُقفل — كتابة):
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/derive-article-versions.ts          # تجربة
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/derive-article-versions.ts --apply  # تطبيق
 * لا يطبع أسرارًا (بصمة المضيف فقط).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const BATCH = 500;

function assertAlignmentConfirmed() {
  if (APPLY && process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error("✗ الكتابة مقفولة. اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED مع --apply.");
    process.exit(1);
  }
}

function safeHost(raw?: string): string {
  if (!raw) return "غير مضبوط";
  try {
    return new URL(raw).hostname;
  } catch {
    return "unparseable";
  }
}

async function main() {
  assertAlignmentConfirmed();
  console.log(`بصمة المضيف: ${safeHost(process.env.DATABASE_URL)} — وضع: ${APPLY ? "تطبيق" : "تجربة"}`);
  console.log("=".repeat(64));

  const totalArticles = await prisma.legalArticle.count();
  // عدد المواد التي لها نسخة واحدة على الأقل (عبر تمييز article_id).
  const distinctVersioned = (await prisma.articleVersion.findMany({ distinct: ["articleId"], select: { articleId: true } })).length;
  console.log(`إجمالي المواد:        ${totalArticles.toLocaleString("en")}`);
  console.log(`مواد لها نسخة سلفًا:   ${distinctVersioned.toLocaleString("en")}`);
  console.log(`ستُشتقّ لها نسخة الآن:  ${(totalArticles - distinctVersioned).toLocaleString("en")}`);

  let processed = 0;
  let created = 0;
  let cursor: string | undefined;

  while (true) {
    const rows = await prisma.legalArticle.findMany({
      select: { id: true, content: true, effectiveFrom: true, royalDecree: true, versions: { select: { id: true }, take: 1 } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    const pending = rows.filter((r) => r.versions.length === 0);
    if (APPLY && pending.length) {
      await prisma.articleVersion.createMany({
        data: pending.map((r) => ({
          articleId: r.id,
          versionText: r.content,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: null,
          royalDecree: r.royalDecree,
          source: "derived"
        }))
      });
      created += pending.length;
    } else {
      created += pending.length; // عدّ نظري في وضع التجربة
    }

    processed += rows.length;
    console.log(`تقدّم: ${processed.toLocaleString("en")} | ${APPLY ? "مُنشأ" : "سيُنشأ"}: ${created.toLocaleString("en")}`);
  }

  const finalVersions = await prisma.articleVersion.count();
  const finalCurrent = await prisma.articleVersion.count({ where: { effectiveTo: null } });
  console.log("\n" + "=".repeat(64));
  console.log(`نسخ article_versions: ${finalVersions.toLocaleString("en")} | نافذة حاليًا (effectiveTo=null): ${finalCurrent.toLocaleString("en")}`);
  if (!APPLY) console.log("(تجربة فقط — أضف --apply للكتابة.)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
