import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkUri, buildExpressionUri, buildUnitUri, parseUri, workUriOf,
  normalizeInstrumentNumber, humanAnchor, EID, UriError,
} from '../../lib/legal-work/hkn-uri.ts';
import { contentHash, normalizeForHash, hasChanged } from '../../lib/legal-work/content-hash.ts';

const murour = {
  country: 'sa', docType: 'act', instrument: 'marsoum',
  hijriDate: '1428-10-26', number: 'م/85',
} as const;

test('بناء معرّف العمل مع تطبيع رقم الأداة', () => {
  assert.equal(buildWorkUri(murour), 'hkm:/sa/act/marsoum/1428-10-26/م-85');
  assert.equal(normalizeInstrumentNumber('م / ٨٥'), 'م-85');
  assert.equal(normalizeInstrumentNumber('474'), '474');
});

test('التعبير والوحدة', () => {
  const w = buildWorkUri(murour);
  const e = buildExpressionUri(w, 'ar', '1446-07-07');
  assert.equal(e, 'hkm:/sa/act/marsoum/1428-10-26/م-85/ar@1446-07-07');
  const u = buildUnitUri(e, EID.child(EID.article(74), EID.paragraph(2)));
  assert.equal(u, 'hkm:/sa/act/marsoum/1428-10-26/م-85/ar@1446-07-07/!main~art_74__para_2');
});

test('التحليل يعيد المستوى الصحيح', () => {
  const w = buildWorkUri(murour);
  const e = buildExpressionUri(w, 'ar', '1446-07-07');
  const u = buildUnitUri(e, 'art_74');
  assert.equal(parseUri(w).level, 'work');
  assert.equal(parseUri(e).level, 'expression');
  assert.equal(parseUri(u).level, 'unit');
  assert.equal((parseUri(u).ref as any).eId, 'art_74');
});

test('نسختان مختلفتان لنفس العمل', () => {
  const w = buildWorkUri(murour);
  const a = buildUnitUri(buildExpressionUri(w, 'ar', '1428-10-26'), 'art_74');
  const b = buildUnitUri(buildExpressionUri(w, 'ar', '1446-07-07'), 'art_74');
  assert.notEqual(a, b);
  assert.equal(workUriOf(a), workUriOf(b)); // العمل واحد
});

test('المادة المدرَجة تأخذ مكررًا لا رقمًا جديدًا', () => {
  assert.equal(EID.article(5), 'art_5');
  assert.equal(EID.article(5, 1), 'art_5_bis');
  assert.equal(EID.article(5, 2), 'art_5_bis2');
});

test('رفض المدخلات الفاسدة', () => {
  assert.throws(() => buildWorkUri({ ...murour, hijriDate: '2007-11-06' } as any), UriError);
  assert.throws(() => buildWorkUri({ ...murour, hijriDate: '1428-13-01' } as any), UriError);
  assert.throws(() => buildExpressionUri('hkm:/sa/act/marsoum/1428-10-26/م-85/ar@1446-07-07', 'ar', '1447-01-01'), UriError);
  assert.throws(() => buildUnitUri('hkm:/sa/act/marsoum/1428-10-26/م-85', 'art_1'), UriError);
  assert.throws(() => parseUri('https://example.com'), UriError);
});

test('المرساة المقروءة', () => {
  assert.equal(humanAnchor('art_74'), '٧٤');
  assert.equal(humanAnchor('art_74__para_2'), '٢/٧٤');
  assert.equal(humanAnchor('art_5_bis'), '٥ مكرر');
});

test('البصمة: المحارف الخفية والتطويل لا تُغيّرها', () => {
  const a = 'يجوز تعديل مجال استعمال المركبة بناءً على طلب مالكها.';
  const b = '\u200fيجوز تعديل مجال اســتعمال  المركبة بناءً على طلب مالكها.\u200e';
  assert.equal(contentHash(a), contentHash(b));
  assert.equal(normalizeForHash(b), a);
});

test('البصمة: تغيّر كلمة أو تشكيل يُكشف', () => {
  const a = 'مدة لا تزيد على عشرة أيام.';
  assert.ok(hasChanged(contentHash(a), 'مدة لا تزيد على خمسة عشر يومًا.'));
  assert.ok(hasChanged(contentHash('الحُكم'), 'الحكم'));
});
