/** HKM-028: اختبار تدقيق الترقيم ببيانات مصطنعة (بلا قاعدة). */
import { CONTENT_ORDINAL_MAX_LINE, FIRST_LINE_FETCH_LIMIT, auditLawNumbering } from "../lib/modules/legal-core/numbering-audit";

let failed = 0;
const ok = (c: boolean, m: string) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};
const T = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة"].map((w) => `المادة ${w}`);

const clean = auditLawNumbering(T.map((title, i) => ({ articleNumber: i + 1, title })));
ok(clean.status === "clean" && clean.matched === 8 && !clean.gaps.length, "نظام مرقّم صحيحًا نظيف");

// سقطت الثالثة فانزاح ما بعدها، وكُررت الأخيرة لسدّ العدد (حالة المعاملات المدنية).
const dropped = [...T.slice(0, 2), ...T.slice(3), T[7]].map((title, i) => ({ articleNumber: i + 1, title }));
const s = auditLawNumbering(dropped);
ok(s.status === "shift", "سقوط مادة يُكشف انزياحًا");
ok(s.runs[0]?.from === 3 && s.runs[0]?.offset === 1 && s.runs[0]?.count === 5, "مقطع الإزاحة يبدأ من موضع السقوط بإزاحة +1");
ok(s.duplicateTitleNumbers.join() === "8", "المادة المكررة لسدّ العدد تُكشف");

const one = auditLawNumbering(T.map((title, i) => ({ articleNumber: i === 4 ? 9 : i + 1, title })));
ok(one.status === "irregular" && one.mismatched === 1 && one.gaps.join() === "5", "اختلاف مفرد غير منتظم مع الرقم الناقص");

const bis = auditLawNumbering([...T.map((title, i) => ({ articleNumber: i + 1, title })), { articleNumber: 9, title: "المادة الثامنة مكرر" }]);
ok(bis.status === "clean" && bis.bis === 1, "«مكرر» لا يُعدّ اختلافًا");

const numeric = auditLawNumbering([{ articleNumber: 1, title: "المادة (1)" }, { articleNumber: 2, title: "المادة ٢" }]);
ok(numeric.status === "clean", "العنوان الرقمي يُقرأ");

const noTitles = auditLawNumbering([{ articleNumber: 1, title: null }, { articleNumber: 2, title: "أحكام عامة" }]);
ok(noTitles.status === "no_ordinal_titles", "نظام بلا عناوين ترتيبية لا يُحكم عليه");

const big = auditLawNumbering([
  { articleNumber: 236, title: "المادة السادسة والثلاثون بعد المائتين" },
  { articleNumber: 237, title: "المادة السابعة والثلاثون بعد المائتين" },
  { articleNumber: 721, title: "المادة الحادية والعشرون بعد السبعمائة" },
]);
ok(big.matched === 3, "الأعداد المركبة بعد المائة");

const colon = auditLawNumbering([
  { articleNumber: 11, title: "المادة الحادية عشرة:" },
  { articleNumber: 21, title: "المادة الحادية والعشرون :" },
  { articleNumber: 62, title: "المادة الثانية والستون:" },
  { articleNumber: 212, title: "المادة الثانية عشرة بعد المائتين:" },
  { articleNumber: 70, title: "المادة السبعون، " },
]);
ok(colon.matched === 5 && colon.status === "clean", "النقطتان والفاصلة الملتصقتان بالعنوان لا تُسقطان الكلمة الأخيرة");
const reg = auditLawNumbering([{ articleNumber: 1, title: "١/١" }, { articleNumber: 2, title: "١/٣" }, { articleNumber: 3, title: "2/3" }]);
ok(reg.parsed === 0 && reg.status === "no_ordinal_titles", "ترقيم اللوائح «مادة/فقرة» لا يُقرأ عددًا ترتيبيًّا");
// «مكرر» مُدرَج بالتسلسل: ما بعده يحمل رقمًا يزيد واحدًا على عنوانه (حالة التأمينات الاجتماعية).
const bisSeq = auditLawNumbering([
  ...T.slice(0, 5).map((title, i) => ({ articleNumber: i + 1, title })),
  { articleNumber: 6, title: "المادة الخامسة مكرر" },
  ...T.slice(5).map((title, i) => ({ articleNumber: i + 7, title })),
]);
ok(bisSeq.status === "shift" && bisSeq.runs[0]?.from === 7 && bisSeq.runs[0]?.offset === -1, "«مكرر» مخزَّن برقم تسلسلي يُزيح ما بعده");

// نظام العمل بعد م/46: عنوان المادة المُعاد ترقيمها يحمل الرقمين، والمعتبر «حالياً».
const renamed = auditLawNumbering([
  { articleNumber: 230, title: "المادة الثلاثون بعد المائتين :" },
  { articleNumber: 231, title: "(المادة الحادية والثلاثون بعد المائتين حالياً) (المادة الأربعون بعد المائتين سابقاً) :" },
  { articleNumber: 232, title: "(المادة الثانية والثلاثون بعد المائتين حالياً) (المادة الثانية والأربعون بعد المائتين سابقاً)" },
]);
ok(renamed.matched === 3 && renamed.mismatched === 0, "الرقم «حالياً» يُقرأ لا «سابقاً»");

// الأمر ٠٨: نظام المحاكم التجارية — العنوان رقمي مشتق من الرقم («المادة 77») والعدد الرسمي في أول سطر من المتن.
const cc = auditLawNumbering([
  { articleNumber: 75, title: "المادة 75", firstLine: "المادة السابعة والسبعون" },
  { articleNumber: 76, title: "المادة 76", firstLine: "المادة الثامنة والسبعون" },
  { articleNumber: 77, title: "المادة 77", firstLine: "المادة التاسعة والسبعون" },
  { articleNumber: 78, title: "المادة 78", firstLine: "المادة الثمانون" },
  { articleNumber: 79, title: "المادة 79", firstLine: "المادة الحادية والثمانون:" },
]);
ok(cc.status === "shift" && cc.fromContent === 5 && cc.runs[0]?.offset === 2 && cc.runs[0]?.count === 5, "العنوان الرقمي المشتق لا يغطي العدد المكتوب في أول سطر المتن (انزياح +2)");
ok(numeric.numericTitles === 2 && numeric.fromContent === 0, "العنوان الرقمي بلا عدد في المتن يُعدّ ويُعلَّم دائريًّا");
const emptyTitle = auditLawNumbering([
  { articleNumber: 1, title: null, firstLine: "المادة الأولى:" },
  { articleNumber: 2, title: "أحكام عامة", firstLine: "المادة الثانية" },
]);
ok(emptyTitle.status === "clean" && emptyTitle.fromContent === 2, "العنوان الخالي من العدد يُقرأ من أول سطر في المتن");
const digitsLine = auditLawNumbering([{ articleNumber: 1, title: null, firstLine: "المادة 5" }, { articleNumber: 2, title: null, firstLine: "المادة 6 يُعمل بهذا النظام" }]);
ok(digitsLine.parsed === 0 && digitsLine.status === "no_ordinal_titles", "أول سطر بالأرقام لا يُعدّ عددًا مكتوبًا");
const longLine = auditLawNumbering([{ articleNumber: 1, title: null, firstLine: "المادة الأولى من هذا النظام تسري على كل من يمارس النشاط التجاري في المملكة العربية السعودية بلا استثناء" }]);
ok(longLine.parsed === 0, "السطر الطويل (متن لا عنوان) لا يُقرأ منه عدد");
ok(FIRST_LINE_FETCH_LIMIT > CONTENT_ORDINAL_MAX_LINE, "ما يجلبه التدقيق من أول سطر أطول من حارس السطر الطويل");
// كما تقطعه القاعدة: left(..., FIRST_LINE_FETCH_LIMIT). لو قُطع إلى 80 لقُرئ «الخامسة… ثلاثين» 35.
const dbCut = (line: string) => line.slice(0, FIRST_LINE_FETCH_LIMIT);
const fifth = "المادة الخامسة: يجب على المدعى عليه تقديم مذكرة الرد خلال ثلاثين يوما من تاريخ إبلاغه بصحيفة الدعوى وإلا عُدّ ذلك تنازلًا";
const cutLine = auditLawNumbering([{ articleNumber: 5, title: "المادة 5", firstLine: dbCut(fifth) }]);
ok(cutLine.fromContent === 0 && cutLine.mismatched === 0, "السطر الطويل مقطوعًا كما تقطعه القاعدة لا يُقرأ منه عدد (لا 35)");
ok(auditLawNumbering([{ articleNumber: 5, title: "المادة 5", firstLine: fifth.slice(0, CONTENT_ORDINAL_MAX_LINE) }]).mismatched === 1, "الاختبار حساس: القطع إلى 80 يقرأ 35 فيُعلَّم مخالفًا");
const wordFirst = auditLawNumbering([{ articleNumber: 3, title: "المادة الثالثة", firstLine: "المادة الرابعة" }]);
ok(wordFirst.matched === 1 && wordFirst.fromContent === 0, "العنوان المكتوب بالكلمات مقدَّم على أول سطر في المتن");

console.log(failed === 0 ? "✓ تدقيق الترقيم" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
