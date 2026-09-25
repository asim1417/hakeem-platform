/**
 * اختبار وحدات لتنقية عرض الأحكام (بلا قاعدة).
 * التشغيل: npm run test:judgment-display-sanitize
 */
import {
  sanitizeDisplayText,
  sanitizeJudgmentDisplay,
  unglueKnownSignatureGlue,
  classifyJudgmentText,
} from "../lib/modules/legal-core/display-text";

let failed = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("✗ " + msg);
  } else {
    console.log("✓ " + msg);
  }
}

// عرض عام
ok(sanitizeDisplayText("مرحبا\u200Bعالم").includes("مرحبا") && !sanitizeDisplayText("مرحبا\u200Bعالم").includes("\u200B"), "يزيل صفرية العرض");
ok(sanitizeDisplayText("البيــــــــان").includes("البيـان") || sanitizeDisplayText("البيــــــــان") === "البيـان", "يختزل التطويل");
ok(sanitizeDisplayText("المادة15").includes("المادة 15"), "يفصل رقم↔عربي");
ok(sanitizeDisplayText("عقد.والطرفان").includes("عقد. والطرفان") || sanitizeDisplayText("عقد.والطرفان").includes("عقد. وال"), "يفصل علامة جملة↔عربي");

// لا يخمّن عربي↔عربي العام
ok(sanitizeDisplayText("عضوفرحان") === "عضوفرحان", "العرض العام لا يفكّ عربي↔عربي");

// قائمة سماح التواقيع
ok(unglueKnownSignatureGlue("عضوفرحان بن يحيى") === "عضو فرحان بن يحيى", "يفكّ عضوفرحان");
ok(unglueKnownSignatureGlue("عضومحمد بن صالح") === "عضو محمد بن صالح", "يفكّ عضومحمد");
ok(unglueKnownSignatureGlue("رئيسالدائرةعبدالوهاب") === "رئيس الدائرة عبدالوهاب", "يفكّ رئيسالدائرة + اسم");
ok(unglueKnownSignatureGlue("رئيس الدائرةعبدالوهاب") === "رئيس الدائرة عبدالوهاب", "يفكّ رئيس الدائرة+اسم");
ok(unglueKnownSignatureGlue("رئيس الدائرة القضائيةعمر بن حسين") === "رئيس الدائرة القضائية عمر بن حسين", "يفكّ القضائية+اسم");
ok(unglueKnownSignatureGlue("رئيس الدائرة القضائية") === "رئيس الدائرة القضائية", "لا يقسّم عنوان الدائرة القضائية");
ok(unglueKnownSignatureGlue("والله الموفقرئيس الدائرة") === "والله الموفق رئيس الدائرة", "يفصل الموفقرئيس");

// لا يُصلح حرفاً ناقصاً
ok(sanitizeJudgmentDisplay("ئيس الدائرة").includes("ئيس الدائرة"), "لا يخترع حرف الراء الناقص");
ok(sanitizeJudgmentDisplay("الموفقريس").includes("الموفقريس"), "لا يحوّل ريس→رئيس");

// مسار الأحكام الكامل
const glued = "نص الحكم: حكمت الدائرة.\nعضوفرحان بن يحيى الفيفي\nرئيس الدائرةعبدالوهاب بن محمد المنصوري";
const fixed = sanitizeJudgmentDisplay(glued);
ok(fixed.includes("عضو فرحان"), "sanitizeJudgmentDisplay يفكّ عضو");
ok(fixed.includes("رئيس الدائرة عبدالوهاب"), "sanitizeJudgmentDisplay يفكّ رئيس الدائرة");

// تصنيف
const clean = classifyJudgmentText("حكمت الدائرة برفض الدعوى. والله الموفق.");
ok(clean.class === "clean", "نص نظيف → clean");

const auto = classifyJudgmentText("عضوفرحان بن يحيى\u200Bالفيفي");
ok(auto.class === "auto_fixable" || auto.changed, "التصاق + صفرية → auto_fixable/changed");
ok(auto.ops.includes("unglue_signature") || auto.ops.includes("strip_zero_width_or_bidi"), "يسجّل العمليات");

const human = classifyJudgmentText("ئيس الدائرة عبدالوهاب");
ok(human.class === "needs_human", "حرف ناقص → needs_human");
ok(human.flags.includes("possible_missing_letter"), "علم possible_missing_letter");

const redacted = classifyJudgmentText("بتاريخ ??/??/????هـ صدر الحكم. والله الموفق.");
ok(redacted.class === "needs_human", "??? → needs_human (لا تُملأ)");
ok(redacted.flags.includes("redaction_placeholders"), "علم redaction_placeholders");

// لا يغيّر المعنى في نص سليم
const pristine = "الحمد لله وحده. حكمت الدائرة برفض الدعوى. والله الموفق.\nعضو فرحان بن يحيى الفيفي\nرئيس الدائرة عبدالوهاب بن محمد المنصوري";
ok(sanitizeJudgmentDisplay(pristine) === pristine.trim(), "النص السليم يبقى كما هو");

console.log(failed === 0 ? "\n✓ نجحت اختبارات تنقية عرض الأحكام" : `\n✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
