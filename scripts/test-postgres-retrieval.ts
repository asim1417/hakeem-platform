/**
 * اختبار أدوات الاسترجاع المعجمي — نقيّ، بلا قاعدة بيانات.
 * يتحقّق من تفكيك السؤال الطبيعي إلى كلمات دالّة، وتطبيع درجة الصلة.
 *
 * التشغيل: npm run test:retrieval
 */
import { tokenizeQuery, normalizeLexicalScore } from "@/lib/modules/legal-search/providers/postgres-provider";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار أدوات الاسترجاع المعجمي");
  console.log("=".repeat(56));

  // ١) تفكيك سؤال طبيعي: يُسقط كلمات الوقف ويُبقي الكلمات الدالّة
  const t = tokenizeQuery("هل يجوز فسخ العقد بسبب الغبن");
  console.log(`  ↪ tokens: ${JSON.stringify(t)}`);
  check(t.includes("فسخ"), "يُبقي «فسخ»");
  check(t.includes("العقد"), "يُبقي «العقد»");
  check(t.includes("الغبن"), "يُبقي «الغبن»");
  check(!t.includes("هل") && !t.includes("يجوز") && !t.includes("بسبب"), "يُسقط كلمات الوقف (هل/يجوز/بسبب)");

  // ٢) حدود وحالات حدّية
  check(tokenizeQuery("").length === 0, "سلسلة فارغة → بلا كلمات");
  check(tokenizeQuery("في من عن").length === 0, "كلمات وقف فقط → بلا كلمات");
  check(tokenizeQuery("عقد عقد العمل").filter((x) => x === "عقد").length === 1, "إزالة التكرار");
  check(tokenizeQuery("ab فسخ").includes("فسخ") && !tokenizeQuery("ab فسخ").includes("ab"), "يُسقط الكلمات الأقصر من ٣ أحرف");
  check(tokenizeQuery("a b c d e f g h i j k l m n o p").length <= 8, "سقف ٨ كلمات");

  // ٣) تطبيع درجة الصلة إلى نطاق 0.55..0.95
  check(Math.abs(normalizeLexicalScore(100, 100) - 0.95) < 1e-9, "الأعلى صلةً → 0.95");
  check(normalizeLexicalScore(0, 100) === 0.55, "صفر/سالب → 0.55 (الحدّ الأدنى)");
  check(normalizeLexicalScore(50, 100) > 0.55 && normalizeLexicalScore(50, 100) < 0.95, "متوسط → بين الحدّين");
  check(normalizeLexicalScore(10, 0) === 0.55, "maxRel=0 → 0.55 بلا قسمة على صفر");
  const s = normalizeLexicalScore(50, 100);
  check(s >= 0.4, "الدرجة فوق حدّ الإسناد (≥0.4) فيمرّ الحارس");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار أدوات الاسترجاع المعجمي.");
}

main();
