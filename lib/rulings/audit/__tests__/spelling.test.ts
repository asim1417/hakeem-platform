import { test } from "node:test";
import assert from "node:assert/strict";
import { addFrequentRulingWords, addText, emptyLexicon } from "../lexicon";
import { measureRuling } from "../metrics";
import { alefFariqa, confusable, spellingVariant } from "../spelling";

function lex() {
  const l = emptyLexicon();
  addText(
    l,
    "أن إن إلى إذا على المسؤولية مسؤولية الاستئناف المحكمة الدعوى الدعوى قاموا حضروا يرجو يدعو " +
      "المدعي المدعى عليه حكمت الدائرة القضية في من عن التجارية",
    50,
  );
  return l;
}

test("همزة القطع في أول الكلمة", () => {
  const l = lex();
  const f = spellingVariant(l, "ان");
  assert.equal(f?.kind, "hamzaInitial");
  assert.deepEqual(new Set(f?.suggestions), new Set(["أن", "إن"]));
  assert.equal(spellingVariant(l, "الى")?.suggestions[0], "إلى");
  assert.equal(spellingVariant(l, "اذا")?.kind, "hamzaInitial");
});

test("الهمزة المتوسطة مع السوابق", () => {
  const l = lex();
  assert.equal(spellingVariant(l, "الاستيناف")?.kind, "hamzaMedial");
  assert.deepEqual(spellingVariant(l, "الاستيناف")?.suggestions, ["الاستئناف"]);
  const f = spellingVariant(l, "والمسئولية");
  assert.equal(f?.kind, "hamzaMedial");
  assert.deepEqual(f?.suggestions, ["والمسؤولية"]);
  assert.deepEqual(spellingVariant(l, "بالمسئولية")?.suggestions, ["بالمسؤولية"]);
});

test("ى/ي وة/ه", () => {
  const l = lex();
  assert.equal(spellingVariant(l, "الدعوي")?.kind, "yaAlif");
  assert.equal(spellingVariant(l, "علي"), null); // علمٌ محتمل: لا يُحكم عليه بلا سياق
  assert.equal(spellingVariant(l, "المحكمه")?.kind, "taHa");
  assert.deepEqual(spellingVariant(l, "للمحكمه")?.suggestions, ["للمحكمة"]);
});

test("الكلمات الصحيحة لا تُرصد", () => {
  const l = lex();
  for (const w of ["أن", "إن", "على", "المحكمة", "بالمحكمة", "والمسؤولية", "الاستئناف", "المدعى", "المدعي"]) {
    assert.equal(spellingVariant(l, w), null, w);
  }
});

test("الألف الفارقة ناقصة وزائدة", () => {
  const l = lex();
  assert.deepEqual(alefFariqa(l, "قامو")?.suggestions, ["قاموا"]);
  assert.equal(alefFariqa(l, "قامو")?.kind, "alefFariqaMissing");
  assert.deepEqual(alefFariqa(l, "يرجوا")?.suggestions, ["يرجو"]);
  assert.equal(alefFariqa(l, "قاموا"), null);
  assert.equal(alefFariqa(l, "يرجو"), null);
});

test("الحروف المتشابهة رسمًا", () => {
  const l = lex();
  assert.deepEqual(confusable(l, "الدغوى")?.suggestions, ["الدعوى"]);
  assert.deepEqual(confusable(l, "الدايرة"), null); // ليس فرق نقط فقط
  assert.equal(confusable(l, "الدعوى"), null); // معروفة
});

test("الكلمة الشائعة في الأحكام لا تصير مرجعًا إملائيًّا", () => {
  const l = lex();
  // «المسئولية» متكررة في الأحكام فتدخل المعجم (معروفة)، لكن لا تصير صحيحة إملائيًّا.
  addFrequentRulingWords(l, Array.from({ length: 6 }, () => "المسئولية ".repeat(5)), 20, 5);
  assert.equal(spellingVariant(l, "المسئولية")?.kind, "hamzaMedial");
});

test("القياس على نصّ حكم يجمع الأنواع", () => {
  const l = lex();
  const m = measureRuling(l, "حكمت الدائره ان المدعي قامو بالاستيناف في الدعوي والدغوى في المحكمة");
  assert.equal(m.spelling.taHa, 1);
  assert.equal(m.spelling.hamzaInitial, 1);
  assert.equal(m.spelling.alefFariqaMissing, 1);
  assert.equal(m.spelling.hamzaMedial, 1);
  assert.equal(m.spelling.yaAlif, 1);
  assert.equal(m.spelling.confusable, 1);
  assert.ok(m.examples.spelling.length >= 6);
});

test("الصيغة النادرة في المرجع النظيف لا تُعدّ صحيحة", () => {
  const l = lex();
  addText(l, "الى", 1); // خطأ نادر في نصّ مادة
  addText(l, "إلى", 200);
  assert.equal(spellingVariant(l, "الى")?.kind, "hamzaInitial");
});
