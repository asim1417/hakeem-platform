import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseArticleOrdinal,
  formatArticleOrdinal,
  toLatinDigits,
  toArabicDigits,
} from '../../lib/legal-work/arabic-ordinals.ts';

const p = (s: string) => parseArticleOrdinal(s);

test('الآحاد', () => {
  assert.equal(p('المادة الأولى')?.number, 1);
  assert.equal(p('المادة الرابعة')?.number, 4);
  assert.equal(p('المادة التاسعة')?.number, 9);
  assert.equal(p('المادة العاشرة')?.number, 10);
});

test('العَقد الأول: أحد عشر إلى تسعة عشر', () => {
  assert.equal(p('المادة الحادية عشرة')?.number, 11);
  assert.equal(p('المادة السابعة عشرة')?.number, 17);
  assert.equal(p('المادة التاسعة عشرة')?.number, 19);
});

test('العقود مع الآحاد، رفعًا وجرًّا', () => {
  assert.equal(p('المادة العشرون')?.number, 20);
  assert.equal(p('المادة الحادية والعشرون')?.number, 21);
  assert.equal(p('المادة الرابعة والسبعون')?.number, 74);
  assert.equal(p('المادة الرابعة والسبعين')?.number, 74);
  assert.equal(p('المادة الثامنة والثمانين')?.number, 88);
});

test('ما فوق المائة', () => {
  assert.equal(p('المادة المائة')?.number, 100);
  assert.equal(p('المادة الثانية بعد المائة')?.number, 102);
  assert.equal(p('المادة الخامسة والأربعين بعد المائة')?.number, 145);
  assert.equal(p('المادة الأولى بعد المائتين')?.number, 201);
});

test('الصيغة الرقمية عربيةً ولاتينيةً وبين قوسين', () => {
  assert.equal(p('المادة (٧٤)')?.number, 74);
  assert.equal(p('المادة 74')?.number, 74);
  assert.equal(p('مادة ١٠٩')?.number, 109);
});

test('المكرر', () => {
  assert.deepEqual(p('المادة الخامسة عشرة مكرراً'), { number: 15, bis: 1 });
  assert.deepEqual(p('المادة الثالثة مكرر'), { number: 3, bis: 1 });
  assert.deepEqual(p('المادة الثالثة مكرراً مرتين'), { number: 3, bis: 2 });
});

test('التشكيل والتطويل والمحارف الخفية لا تُفسد القراءة', () => {
  assert.equal(p('المادةُ الرابعةُ والسبعونَ')?.number, 74);
  assert.equal(p('المــادة الرابعة والسبعون')?.number, 74);
  assert.equal(p('\u200fالمادة الرابعة والسبعون\u200e')?.number, 74);
});

test('ما ليس عنوان مادة يعود null', () => {
  assert.equal(p('الفصل الأول'), null); // «الفصل» ليس مادة — لكن اللفظ يُقرأ؛ يُميَّز بالسياق
  assert.equal(p('نص لا علاقة له'), null);
  assert.equal(p(''), null);
});

test('الصياغة العكسية', () => {
  assert.equal(formatArticleOrdinal(1), 'الأولى');
  assert.equal(formatArticleOrdinal(11), 'الحادية عشرة');
  assert.equal(formatArticleOrdinal(74), 'الرابعة والسبعون');
  assert.equal(formatArticleOrdinal(74, { case: 'gen' }), 'الرابعة والسبعين');
  assert.equal(formatArticleOrdinal(102), 'الثانية بعد المائة');
  assert.equal(formatArticleOrdinal(15, { bis: 1 }), 'الخامسة عشرة مكررًا');
});

test('رحلة ذهاب وعودة لكل الأرقام من ١ إلى ٢٥٠', () => {
  for (let n = 1; n <= 250; n++) {
    for (const c of ['nom', 'gen'] as const) {
      const word = formatArticleOrdinal(n, { case: c });
      const back = parseArticleOrdinal(`المادة ${word}`);
      assert.equal(back?.number, n, `فشل عند ${n} (${c}): «${word}»`);
    }
  }
});

test('الأرقام', () => {
  assert.equal(toLatinDigits('٧٤'), '74');
  assert.equal(toArabicDigits(74), '٧٤');
});
