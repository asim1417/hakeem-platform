/**
 * اختبار حارس التأريض المشترك (lib/modules/grounding/verify-guard.ts).
 * نقيّ بلا قاعدة بيانات: يتحقّق أنّ أيّ رقم مادة يظهر في سرد النموذج ولا سند له في
 * المسترجَع من النواة يُرصَد (فتسقط الخدمة إلى الحتمي)، وأنّ الأرقام المسترجَعة تُقبَل.
 *
 * التشغيل: npx tsx scripts/test-grounding-guard.ts
 */
import { collectAllowedArticleNumbers, collectStrings, verifyNarrativeGrounding } from "../lib/modules/grounding/verify-guard";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${name}`);
  }
}

console.log("── جمع الأرقام المسموحة ──");
const allowed = collectAllowedArticleNumbers({
  numbers: [77, 78, null, 0, -3],
  references: ["نظام العمل، المادة 80", "نظام المعاملات المدنية م/١٣٠", "مبدأ بلا رقم"],
});
check("الأرقام الصريحة الصحيحة تُقبَل (77, 78)", allowed.has(77) && allowed.has(78));
check("الصفر/السالب/العدم تُستبعَد", !allowed.has(0) && !allowed.has(-3));
check("«المادة 80» تُستخرَج من المرجع", allowed.has(80));
check("الصيغة المختصرة «م/١٣٠» تُستخرَج (أرقام عربية)", allowed.has(130));

console.log("\n── تسطيح السرد ──");
const narrative = {
  disputeCharacterization: "نزاع عمالي",
  materialFacts: ["واقعة أ", "واقعة ب"],
  potentialDefenses: [{ text: "دفع", basis: "بموجب المادة 77" }],
  nested: { deep: ["قيمة عميقة"] },
};
const strings = collectStrings(narrative);
check("يجمع السلاسل من كل الأعماق", strings.includes("نزاع عمالي") && strings.includes("واقعة ب") && strings.includes("قيمة عميقة") && strings.includes("بموجب المادة 77"));

console.log("\n── الفحص: سرد مؤرَّض بالكامل ──");
const grounded = verifyNarrativeGrounding(
  ["يستند التحليل إلى المادة 77 والمادة (78) من نظام العمل."],
  new Set([77, 78]),
);
check("لا مخالفات حين كل الأرقام مسترجَعة", grounded.ok && grounded.offending.length === 0);

console.log("\n── الفحص: سرد يحوي مادة مختلقة (اختبار القبول ٥) ──");
const hallucinated = verifyNarrativeGrounding(
  ["بموجب المادة 77 يثبت الحق، وتطبَّق المادة 999 المخترَعة أيضاً."],
  new Set([77, 78, 80, 130]),
);
check("يرصد المادة 999 غير المسترجَعة", !hallucinated.ok && hallucinated.offending.includes(999));
check("لا يرصد المادة 77 المسترجَعة كمخالفة", !hallucinated.offending.includes(77));

console.log("\n── الفحص: إشارة «س/ص» — طرف مسموح ──");
const slash = verifyNarrativeGrounding(["تطبَّق المادة 95/2 على الواقعة."], new Set([95]));
check("لا تُعدّ مخالفة إذا كان أحد طرفيها مسموحاً (95)", slash.ok);

console.log("\n── الفحص: نصّ بلا أرقام مواد ──");
const noNums = verifyNarrativeGrounding(["البيّنة على من ادّعى واليمين على من أنكر."], new Set([77]));
check("نصّ بلا إشارات مواد = مؤرَّض", noNums.ok);

console.log(`\n══ الإجمالي: ${passed} ناجح · ${failed} فاشل ══`);
if (failed > 0) {
  console.error("❌ فشل اختبار حارس التأريض.");
  process.exit(1);
}
console.log("✅ نجح اختبار حارس التأريض.");
