/**
 * اختبار الربط المفاهيمي (matchConcepts / systemMatchesPreferred) — نقيّ، بلا قاعدة.
 * التشغيل: npm run test:concept
 */
import { matchConcepts, systemMatchesPreferred } from "@/lib/modules/legal-core/concept-map";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار الربط المفاهيمي");
  console.log("=".repeat(56));

  // الملكية الفكرية → براءات/حقوق المؤلف + تفضيل أنظمتها
  const ip = matchConcepts("ما حكم الملكية الفكرية؟");
  check(ip.synonyms.some((s) => s.includes("براءات")), "«الملكية الفكرية» → يضيف «براءات الاختراع»");
  check(ip.synonyms.some((s) => s.includes("حقوق المؤلف")), "→ يضيف «حقوق المؤلف»");
  check(ip.preferSystems.some((s) => s.includes("براءات")), "→ يرجّح نظام البراءات");

  // مرادفات تطبيعية (بلا harakat / صيغة بديلة)
  check(matchConcepts("الملكيه الفكريه").synonyms.length > 0, "صيغة بلا تشكيل تُطابق أيضاً");

  // الفصل التعسفي → نظام العمل
  const labor = matchConcepts("تعرضت للفصل التعسفي");
  check(labor.preferSystems.includes("العمل") || labor.preferSystems.some((s) => s.includes("العمل")), "«الفصل التعسفي» → يرجّح نظام العمل");

  // غسل الأموال
  check(matchConcepts("غسل الأموال").preferSystems.some((s) => s.includes("غسل")), "«غسل الأموال» → نظامه");

  // لا مطابقة → فارغ
  check(matchConcepts("الطقس اليوم جميل").synonyms.length === 0, "استعلام غير قانوني → بلا مرادفات");
  check(matchConcepts("").synonyms.length === 0, "فارغ → بلا مرادفات");

  // systemMatchesPreferred
  check(systemMatchesPreferred("نظام براءات الاختراع", ["براءات"]) === true, "اسم النظام يحوي «براءات» → مطابق");
  check(systemMatchesPreferred("لائحة البحوث في وزارة الصحة", ["براءات", "حقوق المؤلف"]) === false, "لائحة صحة لا تطابق أنظمة الملكية الفكرية");
  check(systemMatchesPreferred("نظام العمل", []) === false, "بلا أنظمة مفضّلة → false");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار الربط المفاهيمي.");
}

main();
