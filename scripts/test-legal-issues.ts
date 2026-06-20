/**
 * اختبار طبقة عرض المسائل القانونية (نظرة عامة + تصفّح القسم + العدّ).
 * التشغيل: npm run test:legal-issues
 */
import {
  getLegalIssuesOverview,
  getLegalIssuesBySection,
  getLegalIssuesCount,
  getSectionBooks
} from "@/lib/modules/legal-core/legal-issues";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار المسائل القانونية (الواجهة)");
  console.log("=".repeat(56));

  const ov = getLegalIssuesOverview();
  check(ov.total === 3073, `الإجمالي = 3073 (${ov.total})`);
  check(getLegalIssuesCount() === ov.total, "العدّ يطابق النظرة العامة");
  check(ov.sections.length === 5, `5 أقسام (${ov.sections.length})`);
  check((ov.byStatus.linked ?? 0) > 0, "توزيع الحالات محمّل");

  // مجموع الأقسام = الإجمالي
  const sum = ov.sections.reduce((n, s) => n + s.count, 0);
  check(sum === ov.total, `مجموع مسائل الأقسام = الإجمالي (${sum})`);

  // تصفّح قسم المعاملات المالية
  const fin = getLegalIssuesBySection("financial", 1, 60);
  check(fin.total > 1000 && fin.items.length === 60, `قسم financial: ${fin.total} مسألة، صفحة أولى 60 عنصراً`);
  check(fin.items.every((i) => /^fiqh-[0-9a-f]{12}$/.test(i.issueId)), "كل عنصر يحمل issue_id ثابت");
  check(fin.items.some((i) => i.topArticle?.lawName.includes("المعاملات المدنية")), "عناصر مربوطة بنظام المعاملات المدنية");

  // ترقيم الصفحات
  const p2 = getLegalIssuesBySection("financial", 2, 60);
  check(p2.items.length > 0 && p2.items[0].issueId !== fin.items[0].issueId, "الصفحة الثانية تختلف عن الأولى");

  // فهرس الكتب للقسم
  const books = getSectionBooks("financial");
  check(books.length > 1, `فهرس كتب القسم (${books.length} كتاباً)`);
  check(books.reduce((n, b) => n + b.count, 0) === fin.total, "مجموع مسائل الكتب = إجمالي القسم");

  // تصفية بالكتاب
  const firstBook = books[0].book;
  const byBook = getLegalIssuesBySection("financial", 1, 50, firstBook);
  check(byBook.total === books[0].count, `تصفية بالكتاب «${firstBook}» تطابق عدّه (${byBook.total})`);
  check(byBook.items.every((i) => i.book === firstBook), "كل عناصر الكتاب من الكتاب نفسه");

  // قسم غير موجود → فارغ
  check(getLegalIssuesBySection("nope", 1).total === 0, "قسم غير موجود → فارغ");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار المسائل القانونية.");
}

main();
