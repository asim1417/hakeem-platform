/**
 * اختبارات طبقة ترقيم المواد (بلا قاعدة بيانات) — بوابة جودة تمنع عودة انزياح
 * الترقيم في نظام المعاملات المدنية وغيره.
 *
 * التشغيل: npx tsx scripts/test-article-numbering.ts
 * يخرج برمز 1 عند أي إخفاق — صالح لبوابة CI.
 */
import {
  deriveOfficialNumber,
  splitTitleFromBody,
  planRenumber,
  sha256Normalized,
  type ArticleInput,
} from "../lib/modules/legal-core/article-numbering";

let failed = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) { failed++; console.error("✗ " + msg); }
};

// ① اشتقاق الرقم من العنوان الرسمي — المواد المذكورة صراحةً في أمر التشغيل.
const derivations: Array<[string, number]> = [
  ["المادة السادسة والثلاثون بعد المائتين", 236],
  ["المادة السابعة والثلاثون بعد المائتين", 237],
  ["المادة الثامنة والثلاثون بعد المائتين", 238],
  ["المادة الخامسة والستون بعد الأربعمائة", 465],
  ["المادة السادسة والستون بعد الأربعمائة", 466],
  ["المادة الثامنة والستون بعد الأربعمائة", 468],
  ["المادة التاسعة والستون بعد الأربعمائة", 469],
  ["المادة الرابعة والسبعون بعد الأربعمائة", 474],
  ["المادة الخامسة والسبعون بعد الأربعمائة", 475],
  ["المادة الحادية والعشرون بعد السبعمائة", 721],
];
for (const [title, expected] of derivations) {
  const d = deriveOfficialNumber(title);
  ok(d.number === expected && d.source === "title", `اشتقاق «${title}» → ${d.number} (المتوقع ${expected})`);
}

// ② العنوان الملوّث بمتنٍ ملتصق (المادة 24 في المدونة الحالية) يجب أن يُنظَّف ويُحلَّل.
const contaminated = "المادة الرابعة والعشرون\nتسري على المال العام الأحكام المقررة في هذا النظام ما لم يوجد نصّ خاص.";
const split = splitTitleFromBody(contaminated);
ok(split.title === "المادة الرابعة والعشرون", `تنظيف العنوان الملوّث → «${split.title}»`);
ok(split.cleaned === true && split.extractedBody.startsWith("تسري على المال العام"), "استخراج المتن من العنوان الملوّث");
const d24 = deriveOfficialNumber(contaminated);
ok(d24.number === 24 && d24.source === "title-cleaned", `اشتقاق رقم العنوان الملوّث → ${d24.number} من ${d24.source}`);

// ③ عنوان غير قابل للتحليل يبقى بلا رقم (يُرفع للمراجعة، لا يُخمَّن).
const dBad = deriveOfficialNumber("مقدمة تمهيدية بلا رقم ترتيبي");
ok(dBad.number === null && dBad.source === null, "العنوان غير الترتيبي يبقى بلا رقم (مراجعة بشرية)");

// ④ خطة إعادة الترقيم تُصحّح كل مادة من عنوانها — لا بإزاحة عامة — وترصد الفجوة.
// نحاكي الكسر: أرقام متسلسلة 236 ثمّ 237.. بينما العناوين الرسمية 236 ثمّ 238..
const simulated: ArticleInput[] = [
  { articleNumber: 235, title: "المادة الخامسة والثلاثون بعد المائتين", content: "نصّ 235" },
  { articleNumber: 236, title: "المادة السادسة والثلاثون بعد المائتين", content: "نصّ 236 — تعدد المدينين" },
  // مادة 237 الرسمية مُسقَطة من المصدر — الرقم المتسلسل 237 يحمل عنوان 238:
  { articleNumber: 237, title: "المادة الثامنة والثلاثون بعد المائتين", content: "نصّ 238 — حوالة الحق" },
  { articleNumber: 238, title: "المادة التاسعة والثلاثون بعد المائتين", content: "نصّ 239" },
  { articleNumber: 239, title: "المادة الأربعون بعد المائتين", content: "نصّ 240" },
];
const plan = planRenumber(simulated);
const at = (oldN: number) => plan.changes.find((c) => c.oldNumber === oldN)!;
ok(at(235).status === "noop" && at(236).status === "noop", "المواد قبل الكسر تبقى كما هي");
ok(at(237).newNumber === 238 && at(237).status === "renumber", "المادة المتسلسلة 237 تُصحَّح إلى 238 من عنوانها");
ok(at(238).newNumber === 239 && at(239).newNumber === 240, "بقية السلسلة تُصحَّح من عناوينها لا بإزاحة عمياء");
ok(plan.gaps.includes(237), "الفجوة عند المادة الرسمية 237 مرصودة (مُسقَطة من المصدر)");
ok(plan.duplicateNewNumbers.length === 0, "لا تكرار في الأرقام بعد الاشتقاق");
ok(plan.renumbered === 3, `عدد المواد المعاد ترقيمها = ${plan.renumbered} (المتوقع 3)`);

// ⑤ لا تكرار مشروع: نصّان متطابقان يُنتجان بصمة واحدة (كاشف التكرار).
ok(sha256Normalized("نصّ المادة") === sha256Normalized("نصّ  المادة "), "البصمة تتجاهل فروق المسافات/التطبيع");
ok(sha256Normalized("نصّ أ") !== sha256Normalized("نصّ ب"), "نصّان مختلفان ببصمتين مختلفتين");

// ⑥ خطة بلا فجوات لنظامٍ سليم.
const clean: ArticleInput[] = [
  { articleNumber: 1, title: "المادة الأولى", content: "أ" },
  { articleNumber: 2, title: "المادة الثانية", content: "ب" },
  { articleNumber: 3, title: "المادة الثالثة", content: "ج" },
];
const cleanPlan = planRenumber(clean);
ok(cleanPlan.gaps.length === 0 && cleanPlan.renumbered === 0, "نظام سليم: بلا فجوات ولا إعادة ترقيم");

console.log(failed === 0
  ? `✓ نجحت جميع اختبارات ترقيم المواد`
  : `✗ فشل ${failed} اختبارًا`);
process.exit(failed === 0 ? 0 : 1);
