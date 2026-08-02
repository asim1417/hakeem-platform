// اختبار مُلخِّص فرق الوثائق (تدقيق أداة الوثائق) — دالّةٌ نقيّة بلا قاعدة بيانات.
import assert from "node:assert/strict";
import { summarizeDocDelta } from "../lib/modules/doc-tool/doc-delta";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

check("الحفظ الأوّل: كل الوثائق مُضافة، لا محذوف", () => {
  const r = summarizeDocDelta(null, [{ title: "لائحة" }, { title: "عقد" }]);
  assert.equal(r.docCount, 2);
  assert.equal(r.added, 2);
  assert.equal(r.removed, 0);
  assert.deepEqual(r.addedTitles, ["لائحة", "عقد"]);
});

check("إضافة وثيقة إلى قائمةٍ قائمة", () => {
  const r = summarizeDocDelta([{ title: "لائحة" }], [{ title: "لائحة" }, { title: "حكم" }]);
  assert.equal(r.docCount, 2);
  assert.equal(r.added, 1);
  assert.equal(r.removed, 0);
  assert.deepEqual(r.addedTitles, ["حكم"]);
});

check("حذف وثيقة يُحسب removed بلا added", () => {
  const r = summarizeDocDelta([{ title: "أ" }, { title: "ب" }], [{ title: "أ" }]);
  assert.equal(r.added, 0);
  assert.equal(r.removed, 1);
});

check("المسح الكامل: removed = عدد القديم، docCount صفر", () => {
  const r = summarizeDocDelta([{ title: "أ" }, { title: "ب" }, { title: "ج" }], []);
  assert.equal(r.docCount, 0);
  assert.equal(r.removed, 3);
});

check("لا يُسرّب نصًّا خامًا — العناوين فقط ومقيّدة الطول والعدد", () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ title: "ع".repeat(200) + i }));
  const r = summarizeDocDelta([], many);
  assert.equal(r.addedTitles.length, 20, "حدّ ٢٠ عنوانًا");
  assert.ok(r.addedTitles.every((t) => t.length <= 120), "حدّ ١٢٠ حرفًا للعنوان");
  // لا حقول محتوى (rawText) في المخرَج
  assert.deepEqual(Object.keys(r).sort(), ["added", "addedTitles", "docCount", "removed"]);
});

check("مدخلٌ مُشوَّه (ليس مصفوفة / عناصر بلا عنوان) → لا انهيار", () => {
  assert.deepEqual(summarizeDocDelta("x", { a: 1 }), { docCount: 0, added: 0, removed: 0, addedTitles: [] });
  const r = summarizeDocDelta([{ title: 5 }, {}], [{ title: "صالح" }, { nope: 1 }]);
  assert.equal(r.docCount, 1);
  assert.deepEqual(r.addedTitles, ["صالح"]);
});

console.log(`\nكل اختبارات تدقيق أداة الوثائق ناجحة (${passed})`);
