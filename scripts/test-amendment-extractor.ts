/**
 * test-amendment-extractor.ts — اختبارات المُستخرِج (بلا قاعدة، بلا شبكة).
 * تشغيل: npx tsx scripts/test-amendment-extractor.ts
 */
import assert from "node:assert/strict";
import { extractAmendments } from "@/lib/modules/legal-core/amendment-extractor";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

console.log("مُستخرِج التعديلات:");

test("تعديل صريح بمرسوم وتاريخ → حدث amended واحد", () => {
  const ev = extractAmendments("عُدِّلت هذه المادة بموجب المرسوم الملكي رقم م/51 وتاريخ 13/8/1442هـ");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].changeType, "amended");
  assert.match(ev[0].decreeRef ?? "", /م\/51/);
  assert.match(ev[0].hijriDate ?? "", /1442/);
});

test("إلغاء صريح → repealed", () => {
  const ev = extractAmendments("أُلغيت هذه المادة بموجب المرسوم الملكي رقم م/19 بتاريخ ١٤٣٩/٥/٢٣هـ");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].changeType, "repealed");
  assert.match(ev[0].hijriDate ?? "", /1439/);
});

test("تصويب بقرار مجلس الوزراء → corrected", () => {
  const ev = extractAmendments("صُحّحت بموجب قرار مجلس الوزراء رقم (٧٧٩) وتاريخ 5/9/1443هـ");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].changeType, "corrected");
  assert.match(ev[0].decreeRef ?? "", /779/);
});

test("لا اختلاق: نصّ موضوعيّ فيه «تعديل» بلا أداة → صفر أحداث", () => {
  const ev = extractAmendments("يجوز للطرفين تعديل العقد باتفاقهما كتابةً قبل انتهاء مدّته.");
  assert.equal(ev.length, 0);
});

test("لا اختلاق: أداة الإصدار الأصليّة (بلا فعل تعديل) → صفر أحداث", () => {
  const ev = extractAmendments("نظام المرافعات الشرعية الصادر بالمرسوم الملكي رقم م/1 وتاريخ 22/1/1435هـ");
  assert.equal(ev.length, 0);
});

test("حدثان في نصٍّ واحد (تعديل ثمّ إلغاء) → حدثان بلا تكرار", () => {
  const ev = extractAmendments(
    "عُدِّلت هذه المادة بموجب المرسوم الملكي رقم م/51 وتاريخ 13/8/1442هـ. ثمّ أُلغيت بموجب المرسوم الملكي رقم م/60 وتاريخ 2/3/1444هـ."
  );
  const types = ev.map((e) => e.changeType).sort();
  assert.deepEqual(types, ["amended", "repealed"]);
});

test("إزالة التكرار: نفس الأداة والنوع مرّتين → حدث واحد", () => {
  const ev = extractAmendments(
    "عُدِّلت بموجب المرسوم الملكي رقم م/51 وتاريخ 13/8/1442هـ ... عُدِّلت بموجب المرسوم الملكي رقم م/51 وتاريخ 13/8/1442هـ"
  );
  assert.equal(ev.length, 1);
});

test("تعديل بأرقام عربيّة → يُطبَّع ويُلتقط", () => {
  const ev = extractAmendments("عُدِّلت هذه المادة بموجب المرسوم الملكي رقم (م/١٩١) وتاريخ ٢٠/١١/١٤٤٠هـ");
  assert.equal(ev.length, 1);
  assert.match(ev[0].decreeRef ?? "", /م\/191/);
});

test("نصّ فارغ/معدوم → صفر", () => {
  assert.equal(extractAmendments("").length, 0);
  assert.equal(extractAmendments(null).length, 0);
  assert.equal(extractAmendments(undefined).length, 0);
});

console.log(`\n# تمّ ${passed} اختبارًا${process.exitCode ? " مع إخفاقات" : " — كلّها تمرّ"}`);
