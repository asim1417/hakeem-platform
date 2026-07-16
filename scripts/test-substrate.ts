// اختبار الركيزة (المرحلة ١) — نقيّ بلا قاعدة: النفاذ + تفكيك المعيار + سجلّ الأنظمة.
// يغطّي منطق قبول HLS‑4.2 (تمييز اللاغي) وHLS‑4.4 (رخصة تقديرية/المحكمة) والنطاق.
import { resolveEnforcement, isRepealed, isInForce, enforcementBadge } from "@/lib/modules/agents/substrate/enforcement";
import { inferModality, inferAddressee, inferNormative, isValidModality } from "@/lib/modules/agents/substrate/normative";
import { normalizeSystemName, matchSystemsInText, mentionsSystem } from "@/lib/modules/agents/substrate/systems-registry";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

// ── ١.أ النفاذ ──
check("منسوخة → لاغٍ وغير نافذ", resolveEnforcement("منسوخة").state === "لاغٍ" && !resolveEnforcement("منسوخة").inForce);
check("سارية → ساري نافذ", resolveEnforcement("سارية").state === "ساري" && resolveEnforcement("سارية").inForce);
check("معدّلة → معدّل ونافذ", resolveEnforcement("معدلة").state === "معدّل" && isInForce("معدلة"));
check("موقوفة → غير نافذ", !isInForce("موقوفة"));
check("REPEALED (إنجليزي) → لاغٍ", isRepealed("REPEALED"));
check("شارة اللاغي تحذيرية، والساري بلا شارة", enforcementBadge("منسوخة")?.warn === true && enforcementBadge("سارية") === null);

// ── ١.ب تفكيك المعيار ──
check("حظر: «لا يجوز…»", inferModality("لا يجوز للتاجر مزاولة النشاط قبل القيد") === "حظر");
check("إلزام: «يجب على…»", inferModality("يجب على صاحب العمل أداء الأجر في موعده") === "إلزام");
check("إباحة: «يحق للعامل…»", inferModality("يحق للعامل إنهاء العقد") === "إباحة");
check("رخصة تقديرية: «للمحكمة أن…»", inferModality("للمحكمة أن تحكم بالتعويض بحسب ما تراه محققًا للعدل") === "رخصة_تقديرية");
check("المخاطَب = المحكمة", inferAddressee("للمحكمة أن تقضي بذلك") === "المحكمة");
check("المخاطَب = صاحب العمل", inferAddressee("يلتزم صاحب العمل بتوفير بيئة آمنة") === "صاحب العمل");
check("الوسم الكامل يجمع المخاطَب والحكم", (() => {
  const t = inferNormative("للمحكمة أن تخفّض الشرط الجزائي متى رأت مبالغة");
  return t.modality === "رخصة_تقديرية" && t.addressee === "المحكمة" && t.source === "rule";
})());
check("حارس modality يرفض قيمة فاسدة", !isValidModality("ربما") && isValidModality("حظر"));

// ── ١.ج سجلّ الأنظمة والنطاق ──
check("تطبيع «نظام العمل» → «العمل»", normalizeSystemName("نظام العمل") === normalizeSystemName("العمل"));
check("تطبيع اللائحة التنفيذية يزيل الأداة", normalizeSystemName("اللائحة التنفيذية لنظام العمل").includes("العمل"));
const REG = [
  { id: "s1", name: "نظام العمل" },
  { id: "s2", name: "نظام المعاملات المدنية" },
  { id: "s3", name: "النظام المدني" },
];
check("مطابقة النظام في السؤال", matchSystemsInText("ما مدة إشعار إنهاء عقد العمل؟", REG).some((r) => r.id === "s1"));
check("الأخصّ أولًا: «المعاملات المدنية» قبل «المدني»", (() => {
  const hits = matchSystemsInText("التعويض في نظام المعاملات المدنية", REG);
  return hits.length > 0 && hits[0].id === "s2";
})());
check("mentionsSystem كاذب عند غياب أيّ نظام", !mentionsSystem("ما هو التعويض عمومًا؟", REG));

console.log(`\nنتيجة: ${pass} نجح، ${fail} فشل`);
process.exit(fail ? 1 : 0);
