/**
 * اختبار جسر النواة ↔ المسائل الفقهية (getFiqhIssuesForArticle).
 * نقيّ، يقرأ data/fiqh-article-index.json. التشغيل: npm run test:fiqh-core
 */
import {
  getFiqhIssuesForArticle,
  hasFiqhIssues,
  fiqhIssuesStats
} from "@/lib/modules/legal-core/fiqh-issues";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار جسر النواة ↔ المسائل الفقهية");
  console.log("=".repeat(56));

  const stats = fiqhIssuesStats();
  check(!!stats && stats.articles > 0, `الفهرس محمّل (${stats?.articles} مادة · ${stats?.issueLinks} رابط)`);

  // مادة معروفة: نظام المعاملات المدنية المادة 358 → مسائل البيع
  const issues = getFiqhIssuesForArticle("نظام المعاملات المدنية", 358);
  check(issues.length > 0, `المادة (358) لها مسائل مرتبطة (${issues.length})`);
  check(issues.some((i) => i.title.includes("البيع")), "تتضمّن مسألة عن «البيع»");
  check(issues.every((i) => /^fiqh-[0-9a-f]{12}$/.test(i.issueId)), "كل مسألة تحمل issue_id ثابت");
  check(issues.every((i) => i.linkStatus === "linked" || i.linkStatus === "needs_review"), "روابط واثقة فقط (linked/needs_review)");

  // الحدّ يعمل
  check(getFiqhIssuesForArticle("نظام المعاملات المدنية", 358, 3).length <= 3, "الحدّ (limit) يُحترَم");

  // hasFiqhIssues
  check(hasFiqhIssues("نظام المعاملات المدنية", 358) === true, "hasFiqhIssues = true للمادة المرتبطة");

  // مادة غير موجودة → []
  check(getFiqhIssuesForArticle("نظام غير موجود", 99999).length === 0, "مادة بلا ربط → قائمة فارغة");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار جسر المسائل الفقهية.");
}

main();
