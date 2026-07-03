// اختبارات وحدة فحص الوثائق — تُشغَّل بـ: npm run test:document-inspection
// حتمية بالكامل: لا شبكة ولا قاعدة بيانات.

import assert from "node:assert/strict";
import {
  analyzeDocuments,
  assessQuality,
  classifyType,
  detectIssuer,
  detectTopics,
  extractEntities,
  extractHijriYear,
  makeCode,
  normalizeForMatch,
  sampleCaseDocuments,
  segmentParagraph,
  validateReference
} from "../lib/modules/document-inspection";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

// ── اتساق المرجع ──
check("المرجع التشغيلي سليم الاتساق", () => {
  assert.deepEqual(validateReference(), []);
});

// ── التطبيع ──
check("التطبيع: همزات وتاء مربوطة وأرقام هندية", () => {
  assert.equal(normalizeForMatch("المَادَّة"), "الماده");
  assert.equal(normalizeForMatch("إلى أَحكام الإثبات"), "الي احكام الاثبات");
  assert.equal(normalizeForMatch("١٤٤٦/٠٣/١٢"), "1446/03/12");
});

// ── التصنيف ──
check("تصنيف عبر العنوان: صك حكم → HKM", () => {
  const r = classifyType("صك حكم — رفض دعوى بيع الحصص", "");
  assert.equal(r.code, "HKM");
  assert.equal(r.matchedOn, "title");
});

check("تصنيف عبر المتن: «حكمت الدائرة» → HKM", () => {
  const r = classifyType("وثيقة واردة", "وبعد المداولة حكمت الدائرة برفض الدعوى");
  assert.equal(r.code, "HKM");
  assert.equal(r.matchedOn, "body");
});

check("تصنيف عقد: عقد بيع حصص → AQD", () => {
  const r = classifyType("عقد بيع حصص — النسخة الموقّعة", "اتفق الطرفان على البيع");
  assert.equal(r.code, "AQD");
});

check("نص غير معروف → UNK بلا اختلاق", () => {
  const r = classifyType("قائمة تسوق", "خبز وحليب وتمر");
  assert.equal(r.code, "UNK");
  assert.equal(r.name, "غير مصنّف");
});

// ── كشف الجهة ──
check("كشف الجهة: المحكمة التجارية → TIJ", () => {
  const r = detectIssuer(
    "المملكة العربية السعودية وزارة العدل المحكمة التجارية بجدة الدائرة الأولى صك حكم رقم 31420786 وتاريخ 1446/03/12"
  );
  assert.equal(r.code, "TIJ");
});

check("كشف الجهة: كتابة العدل → ADL", () => {
  const r = detectIssuer("المملكة العربية السعودية وزارة العدل كتابة العدل رقم الوثيقة 55231 وتاريخ 1445/11/04");
  assert.equal(r.code, "ADL");
});

check("ترويسة بلا دلالة → UNK", () => {
  assert.equal(detectIssuer("مذكرة داخلية بلا ترويسة").code, "UNK");
});

// ── السنة الهجرية والرمز ──
check("السنة من تاريخ صريح بأرقام هندية", () => {
  assert.equal(extractHijriYear("وتاريخ ١٤٤٦/٠٣/١٢هـ"), "1446");
});

check("السنة المستقلة، وعدم التقاطها من رقم أطول", () => {
  assert.equal(extractHijriYear("في عام 1445 الموافق"), "1445");
  assert.equal(extractHijriYear("رقم الصك 31446078"), "0000");
});

check("الرمز الهرمي بصيغة {TYPE}.{ISSUER}.{YEAR}.{SEQ}", () => {
  assert.equal(makeCode("HKM", "TIJ", "1446", 1), "HKM.TIJ.1446.001");
  assert.equal(makeCode("AQD", "ADL", "1445", 3), "AQD.ADL.1445.003");
});

// ── الكيانات ──
const JUDGMENT_TEXT = `وبناءً على الدعوى المقامة من شركة الأفق التجارية ضد مؤسسة النخبة القابضة، في شأن المطالبة بمبلغ ٣٣١٬٠٠٠٬٠٠٠ ريال، واستنادًا إلى الصك رقم ٣١٤٢٠٧٨٦ وإلى المادة (٥٣) من نظام المحاكم التجارية وتاريخ ١٤٤٦/٠٣/١٢هـ`;

check("استخراج الكيانات: أطراف ومبلغ وصك ونظام وتاريخ", () => {
  const entities = extractEntities(JUDGMENT_TEXT);
  const byKind = (k: string) => entities.filter((e) => e.kind === k).map((e) => e.value);
  assert.deepEqual(byKind("party"), ["شركة الأفق التجارية", "مؤسسة النخبة القابضة"]);
  assert.deepEqual(byKind("amount"), ["٣٣١٬٠٠٠٬٠٠٠"]);
  assert.deepEqual(byKind("deed"), ["٣١٤٢٠٧٨٦"]);
  assert.equal(byKind("date")[0], "١٤٤٦/٠٣/١٢هـ");
  assert.ok(byKind("law")[0].includes("نظام المحاكم التجارية"));
});

check("تقسيم الفقرة: المقاطع تعيد بناء النص الأصلي حرفياً", () => {
  const segments = segmentParagraph(JUDGMENT_TEXT);
  assert.equal(segments.map((s) => s.text).join(""), JUDGMENT_TEXT);
  assert.ok(segments.some((s) => s.kind === "party"));
  assert.ok(segments.some((s) => s.kind === "amount"));
});

// ── المكنز ──
check("المكنز: غبن وتدليس → عيوب الإرادة", () => {
  const topics = detectTopics("طلب الفسخ لعيبٍ في الرضا من غبنٍ وتدليس");
  assert.ok(topics.includes("عيوب الإرادة"));
});

// ── الجودة ──
check("الجودة: نص قانوني سليم يقيَّم عالياً، ومسح مشوَّه يحتاج مراجعة", () => {
  const clean = assessQuality(JUDGMENT_TEXT + " " + JUDGMENT_TEXT);
  assert.equal(clean.grade, "high");
  const garbled = assessQuality("إشارة إلى م/ن ٤٤ وت�ريخ ١٤�٥ بخصو� متا�عة");
  assert.equal(garbled.grade, "review");
});

// ── العينة عبر الخط الكامل ──
check("العينة: ستّ وثائق كلها مصنّفة وبرموز فريدة", () => {
  const docs = sampleCaseDocuments();
  assert.equal(docs.length, 6);
  assert.equal(new Set(docs.map((d) => d.code)).size, 6);
  const judgment = docs[0];
  assert.equal(judgment.code, "HKM.TIJ.1446.001");
  assert.equal(judgment.issuer.code, "TIJ");
  assert.equal(judgment.quality.grade, "high");
  const contract = docs[1];
  assert.equal(contract.type.code, "AQD");
  assert.equal(contract.issuer.code, "ADL");
  assert.equal(contract.hijriYear, "1445");
  const scanned = docs[4];
  assert.equal(scanned.quality.grade, "review");
});

check("التسلسل داخل (النوع×الجهة×السنة)", () => {
  const twin = analyzeDocuments([
    { title: "صك حكم أول", rawText: "المحكمة التجارية حكمت الدائرة بتاريخ 1446/01/01" },
    { title: "صك حكم ثانٍ", rawText: "المحكمة التجارية حكمت الدائرة بتاريخ 1446/02/02" }
  ]);
  assert.equal(twin[0].code, "HKM.TIJ.1446.001");
  assert.equal(twin[1].code, "HKM.TIJ.1446.002");
});

console.log(`\nكل الاختبارات ناجحة (${passed})`);
