import { test } from "node:test";
import assert from "node:assert/strict";
import { addFrequentRulingWords, addText, emptyLexicon, isKnown, keyForm, rawForm } from "../lexicon";
import {
  containsWholeWord,
  measureRuling,
  qualityScore,
  qualityTier,
  segmentWord,
  simulateClean,
  simulatedSearchText,
} from "../metrics";

function lex() {
  const l = emptyLexicon();
  addText(
    l,
    "المحكمة الدعوى المدعي المدعى عليه حكمت الحكم العقد فسخ الغبن الفاحش التجارية الدائرة الاستئناف " +
      "مستأجرين المستأجرين الإيجار على إلى التي القضية رقم بتاريخ وحيث إن أن ثبت لدى الدائرة الثالثة " +
      "المبلغ مبلغ ريال سداد وقدره الأجرة الوكالة التعويض الضرر في عن من إلزام",
    50,
  );
  return l;
}

test("rawForm يحوّل أشكال العرض ويحذف الخفيّ والتطويل", () => {
  // «ﻻ» شكل عرض للام-ألف، و U+200F علامة اتجاه، و ـ تطويل.
  assert.equal(rawForm("ﻻ‏المحكـــمة"), "لاالمحكمة");
});

test("keyForm توحّد الألف والياء والتاء المربوطة", () => {
  assert.equal(keyForm("إلى المحكمة"), "الي المحكمه");
});

test("isKnown يقبل السوابق الشائعة", () => {
  const l = lex();
  assert.ok(isKnown(l, "والمحكمة"));
  assert.ok(isKnown(l, "بالعقد"));
  assert.ok(isKnown(l, "للمدعي"));
  assert.ok(!isKnown(l, "سونجشانج"));
});

test("لا تُعدّ الكلمات الطويلة الصحيحة ملتصقة", () => {
  const l = lex();
  for (const w of ["والمستأجرين", "بالاستئناف", "فسيكفيكهم"]) {
    const m = measureRuling(l, `${w} `.repeat(3));
    assert.equal(m.gluedWords, 0, w);
  }
});

test("رصد الكلمة الملتصقة وتقسيمها", () => {
  const l = lex();
  const seg = segmentWord(l, "المحكمةالتجارية");
  assert.deepEqual(seg?.parts, ["المحكمة", "التجارية"]);
  const m = measureRuling(l, "حكمت المحكمةالتجارية في الدعوى");
  assert.equal(m.gluedWords, 1);
});

test("رصد الكلمة المكسورة «المح كمة»", () => {
  const l = lex();
  const m = measureRuling(l, "حكمت المح كمة في الدعوى");
  assert.equal(m.brokenPairs, 1);
  assert.equal(m.examples.broken[0].merged, "المحكمة");
});

test("رصد النص المعكوس «ةمكحملا»", () => {
  const l = lex();
  const m = measureRuling(l, "ةمكحملا ىوعدلا");
  assert.equal(m.reversedWords, 2);
});

test("أشكال العرض والرموز الخفية والرموز الغريبة", () => {
  const l = lex();
  const m = measureRuling(l, "ﺍﻟﻤﺤﻜﻤﺔ​ الدعوى □ �");
  assert.ok(m.presentationForms >= 7);
  assert.equal(m.hiddenChars, 1);
  assert.equal(m.ocrBadSymbols, 2);
});

test("الرقم اللاتيني داخل كلمة، مع استثناء 1443هـ و2021م", () => {
  const l = lex();
  assert.equal(measureRuling(l, "بتاريخ 1443هـ و 2021م").ocrLatinDigitInWord, 0);
  assert.equal(measureRuling(l, "المح5كمة").ocrLatinDigitInWord, 1);
});

test("خلط ى/ي في آخر الكلمة", () => {
  const l = lex();
  const m = measureRuling(l, "حكمت المحكمة علي المدعي");
  assert.equal(m.ocrYaAlif, 1); // «علي» بدل «على» (المعجم النظيف فيه «على» فقط)
});

test("الكلمات المتكررة في الأحكام تُضاف للمعجم دون أن تصير مرجعًا نظيفًا", () => {
  const l = emptyLexicon();
  const docs = Array.from({ length: 6 }, () => "ناظر ".repeat(5));
  assert.equal(addFrequentRulingWords(l, docs, 20, 5), 1);
  assert.ok(isKnown(l, "ناظر"));
  assert.ok(!l.raw.has("ناظر"));
});

test("درجة الجودة والفئات", () => {
  const l = lex();
  const good = measureRuling(l, "حكمت المحكمة في الدعوى بفسخ العقد وإلزام المدعى عليه بالتعويض عن الضرر. ".repeat(10));
  assert.equal(qualityTier(qualityScore(good)), "sound");
  const empty = measureRuling(l, "");
  assert.equal(qualityScore(empty), 0);
  assert.equal(qualityTier(0), "damaged");
  assert.equal(qualityTier(75), "repairable");
  assert.equal(qualityTier(50), "poor");
});

test("التنظيف المحاكى يدمج المكسور ويفصل الملتصق", () => {
  const l = lex();
  const r = simulateClean(l, "حكمت المح كمة في الدعوى المحكمةالتجارية");
  assert.equal(r.text, "حكمت المحكمة في الدعوى المحكمة التجارية");
  assert.equal(r.edits.length, 2);
});

test("مطابقة الكلمة الكاملة لا تلتقط «نجش» داخل «سونجشانج»", () => {
  assert.equal(containsWholeWord(simulatedSearchText("شركة سونجشانج المحدودة"), "نجش"), false);
  assert.equal(containsWholeWord(simulatedSearchText("ثبت النجش في البيع"), "نجش"), true);
  assert.equal(containsWholeWord(simulatedSearchText("وقع بالغبن الفاحش"), "الغبن"), true);
  assert.equal(containsWholeWord(simulatedSearchText("وقع بالغبن الفاحش"), "الغبن الفاحش"), true);
  assert.equal(containsWholeWord(simulatedSearchText("طلب فسخ العقد"), "فسخ"), true);
  assert.equal(containsWholeWord(simulatedSearchText("طلب الفسخ"), "فسخ"), true);
});
