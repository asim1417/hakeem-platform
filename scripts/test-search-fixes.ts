/**
 * اختبار إصلاحات البحث/الواجهات (فحص الإنتاج) — نقيّ، بلا قاعدة.
 * يغطّي: تحليل «المادة {رقم} {نظام}» (#2) وثبات تطبيع slug ثنائي الاتجاه (#5).
 * التشغيل: npm run test:search-fixes
 */
import { parseArticleQuery } from "@/lib/modules/legal-search/hybrid-search";
import { lawSlug } from "@/lib/modules/legal-core/eli";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار إصلاحات البحث/الواجهات");
  console.log("=".repeat(56));

  console.log("\n— #2: تحليل «المادة {رقم} {نظام}» —");
  const p1 = parseArticleQuery("المادة 226 المعاملات");
  check(p1?.articleNumber === 226 && p1?.systemHint.includes("المعاملات"), "«المادة 226 المعاملات» → 226 + تلميح المعاملات");
  const p2 = parseArticleQuery("م/80 نظام العمل");
  check(p2?.articleNumber === 80 && p2?.systemHint.includes("عمل"), "«م/80 نظام العمل» → 80 + تلميح عمل");
  check(parseArticleQuery("المقاصة") === null, "«المقاصة» (بلا رقم) → null");
  check(parseArticleQuery("المادة 5") === null, "«المادة 5» (بلا اسم نظام) → null");

  console.log("\n— SEARCH-001: أرقام المواد بالأرقام العربية-الهندية —");
  const a1 = parseArticleQuery("المادة ٢٢٦ المعاملات");
  check(a1?.articleNumber === 226 && a1?.systemHint.includes("المعاملات"), "«المادة ٢٢٦ المعاملات» → 226 + تلميح المعاملات");
  const a2 = parseArticleQuery("م/٨٠ نظام العمل");
  check(a2?.articleNumber === 80 && a2?.systemHint.includes("عمل"), "«م/٨٠ نظام العمل» → 80 + تلميح عمل");

  console.log("\n— #5: تطبيع slug ثنائي الاتجاه (ة/ه، الهمزات) —");
  check(lawSlug("نظام-الإثبات") === lawSlug("نظام-الاثبات"), "الهمزة والألف المجرّدة تتطابقان بعد التطبيع");
  check(lawSlug("نظام-المعاملات-المدنية") === lawSlug("نظام-المعاملات-المدنيه"), "التاء المربوطة والهاء تتطابقان");
  const once = lawSlug("نظام الإثبات");
  check(lawSlug(once) === once, "التطبيع idempotent (تطبيق مكرّر لا يغيّر)");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار إصلاحات البحث/الواجهات.");
}

main();
