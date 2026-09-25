/**
 * اختبار provenance + النسخ الزمنية + بوابة المصدر (يتطلب قاعدة staging).
 * التشغيل: npx tsx scripts/test-article-provenance.ts
 *
 * يعمل على نظامٍ اختباريّ معزول (اسم فريد) ثمّ ينظّف نفسه — لا يمسّ بيانات حقيقية.
 * يتحقق من:
 *   4.7 تحديث النصّ يُنشئ نسخة جديدة ولا يطغى على السابقة.
 *   4.8 مصدر غير رسمي لا يعتمد تعديلًا تلقائيًّا (يبقى اقتراحًا للمراجعة).
 */
import { PrismaClient } from "@prisma/client";
import { upsertLegalArticle, isOfficialSourceUrl, resolveReviewStatus } from "../lib/modules/legal-core/article-upsert";

const prisma = new PrismaClient();
const LAW = `__اختبار_provenance_${Date.now()}`;
let failed = 0;
const ok = (c: boolean, m: string) => { if (!c) { failed++; console.error("✗ " + m); } };

async function cleanup() {
  const arts = await prisma.legalArticle.findMany({ where: { lawName: LAW }, select: { id: true } });
  const ids = arts.map((a) => a.id);
  if (ids.length) {
    await prisma.articleVersion.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.articleAmendment.deleteMany({ where: { articleId: { in: ids } } });
    await prisma.legalArticle.deleteMany({ where: { id: { in: ids } } });
  }
}

async function main() {
  try {
    await cleanup();

    // ① بوابة المصدر (وحدة).
    ok(isOfficialSourceUrl("https://laws.boe.gov.sa/x") === true, "boe رسمي");
    ok(isOfficialSourceUrl("https://laws.moj.gov.sa/x") === true, "moj رسمي (مساعد)");
    ok(isOfficialSourceUrl("https://nezams.com/x") === false, "nezams غير رسمي");
    ok(isOfficialSourceUrl("http://laws.boe.gov.sa/x") === false, "http يُرفض");
    ok(resolveReviewStatus("verified", false) === "needs_review", "غير الرسمي لا يُعتمد verified");
    ok(resolveReviewStatus("verified", true) === "verified", "الرسمي يُعتمد verified");

    // ② إنشاء مادة من مصدر رسمي.
    const c1 = await upsertLegalArticle(prisma, {
      lawName: LAW, articleNumber: 1, title: "المادة الأولى", content: "النصّ الأصلي.",
      provenance: { sourceUrl: "https://laws.boe.gov.sa/a/1", sourcePublisher: "هيئة الخبراء" },
      requestedReviewStatus: "verified",
    }, { apply: true });
    ok(c1.action === "created" && c1.reviewStatus === "verified", "إنشاء مادة رسمية verified");

    // ③ إعادة نفس المحتوى ⇒ noop (idempotent) بلا نسخة جديدة.
    const c2 = await upsertLegalArticle(prisma, {
      lawName: LAW, articleNumber: 1, title: "المادة الأولى", content: "النصّ الأصلي.",
      provenance: { sourceUrl: "https://laws.boe.gov.sa/a/1" },
    }, { apply: true });
    ok(c2.action === "noop" && c2.versioned === false, "إعادة نفس النصّ = noop idempotent");
    ok((await prisma.articleVersion.count({ where: { article: { lawName: LAW } } })) === 0, "لا نسخ بعد noop");

    // ④ تغيّر النصّ من مصدر رسمي ⇒ نسخة سابقة محفوظة + تحديث النصّ.
    const c3 = await upsertLegalArticle(prisma, {
      lawName: LAW, articleNumber: 1, title: "المادة الأولى", content: "النصّ المعدّل رسميًّا.",
      provenance: { sourceUrl: "https://laws.boe.gov.sa/a/1" },
    }, { apply: true });
    ok(c3.action === "updated" && c3.versioned === true, "تعديل رسمي يُنشئ نسخة");
    const live = await prisma.legalArticle.findUnique({
      where: { lawName_articleNumber: { lawName: LAW, articleNumber: 1 } },
      select: { content: true },
    });
    ok(live?.content === "النصّ المعدّل رسميًّا.", "النصّ الحيّ صار المعدّل");
    const versions = await prisma.articleVersion.findMany({ where: { article: { lawName: LAW } } });
    ok(versions.length === 1 && versions[0].versionText === "النصّ الأصلي.", "النسخة السابقة محفوظة بلا طغيان");

    // ⑤ تعديل من مصدر غير رسمي ⇒ لا يُطبَّق؛ يبقى اقتراحًا في article_amendments.
    const c4 = await upsertLegalArticle(prisma, {
      lawName: LAW, articleNumber: 1, title: "المادة الأولى", content: "نصّ من مصدر غير رسمي.",
      provenance: { sourceUrl: "https://nezams.com/a/1" },
    }, { apply: true });
    ok(c4.action === "proposed-change" && c4.reviewStatus === "needs_review", "غير الرسمي = اقتراح للمراجعة");
    const stillLive = await prisma.legalArticle.findUnique({
      where: { lawName_articleNumber: { lawName: LAW, articleNumber: 1 } },
      select: { content: true },
    });
    ok(stillLive?.content === "النصّ المعدّل رسميًّا.", "النصّ الرسمي لم يُطغَ عليه من مصدر غير رسمي");
    const proposals = await prisma.articleAmendment.count({ where: { article: { lawName: LAW }, reviewStatus: "needs_review" } });
    ok(proposals === 1, "اقتراح التعديل مسجَّل للمراجعة");

    console.log(failed === 0 ? "✓ نجحت اختبارات provenance والنسخ والبوابة" : `✗ فشل ${failed}`);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
