import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCourt, classifyDegree, deriveMeta, hijriToGregorianIso, parseHijriDate, stripLabel, textShape } from "../meta";

test("إزالة البادئة الثابتة", () => {
  assert.equal(stripLabel("محكمة: المحكمة التجارية"), "المحكمة التجارية");
  assert.equal(stripLabel("المدينه: الرياض"), "الرياض");
  assert.equal(stripLabel("محكمة: المحكمة العليا -  الهيئة الدائمة"), "المحكمة العليا - الهيئة الدائمة");
  assert.equal(stripLabel(null), null);
});

test("التاريخ الهجري بأرقام هندية ولاتينية وبالترتيبين", () => {
  assert.deepEqual(parseHijriDate("١٢/٠٥/١٤٤٣هـ"), { year: 1443, month: 5, day: 12, shape: "dd/dd/dddda" });
  assert.equal(parseHijriDate("1443/5/12")?.day, 12);
  assert.equal(parseHijriDate("عام ١٤٤٠")?.year, 1440);
  assert.equal(parseHijriDate("عام ١٤٤٠")?.month, null);
  assert.equal(parseHijriDate("2021/05/12"), null);
  assert.equal(parseHijriDate(""), null);
});

test("التحويل الميلادي الجدولي", () => {
  // ١/٩/١٤٤٤هـ ≈ ٢٣/٣/٢٠٢٣م (أم القرى)؛ الجدولي قد يختلف يومًا.
  const g = hijriToGregorianIso({ year: 1444, month: 9, day: 1, shape: "" })!;
  assert.match(g, /^2023-03-2[2-4]$/);
  assert.equal(hijriToGregorianIso({ year: 1444, month: null, day: null, shape: "" }), null);
});

test("نوع المحكمة والدرجة لكل القيم الفعلية في القاعدة", () => {
  const cases: Array<[string, string, string]> = [
    ["محكمة: المحكمة التجارية", "تجارية", "ابتدائي"],
    ["محكمة: المحكمة العامة", "عامة", "ابتدائي"],
    ["محكمة: المحكمة العليا -  الهيئة الدائمة", "أخرى", "عليا"],
    ["محكمة: مجلس القضاء الأعلى - الهيئة الدائمة", "أخرى", "عليا"],
    ["محكمة: المحكمة العمالية", "عمالية", "ابتدائي"],
    ["محكمة: المحكمة الجزائية", "جزائية", "ابتدائي"],
  ];
  for (const [court, type, degree] of cases) {
    assert.equal(classifyCourt(court), type, court);
    assert.equal(classifyDegree(court), degree, court);
  }
  assert.equal(classifyCourt("محكمة الاستئناف: محكمة الاستئناف"), "استئناف");
  assert.equal(classifyCourt("محكمة: جهة غير معروفة"), null);
});

test("شكل النص لا يكشف المحتوى", () => {
  assert.equal(textShape("بتاريخ ١٤٤٣/٠٥/١٢هـ"), "a dddd/dd/dda");
});

test("اشتقاق السجل كاملًا", () => {
  const m = deriveMeta({
    id: "c1", court: "محكمة: المحكمة التجارية", cityName: "المدينه: جدة", courtOfAppeal: "",
    decisionDateText: "", caseDateText: "٠٣/٠٢/١٤٤٢", judgmentText: "نص", appealText: "استئناف",
  });
  assert.equal(m.year_h, 1442);
  assert.equal(m.date_source, "case");
  assert.equal(m.city_norm, "جدة");
  assert.equal(m.appeal_court_norm, null);
  assert.equal(m.has_appeal_text, true);
  assert.equal(m.content_hash.length, 64);
  assert.equal(m.extractor_version, "meta-v1");
});
