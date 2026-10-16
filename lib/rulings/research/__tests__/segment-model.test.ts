import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAnswer, regionInput, verifyQuote } from "../segment-model";

const text = "فأجاب قائلا إن العقد صحيح.\n\nوحيـــث إنَّ الغبن   الفاحش لا يثبت إلا بالبينة ولما كان المدعي لم يقدم بينة لذلك حكمت الدائرة برفض الدعوى";

test("الاقتباس يُطابَق رغم التشكيل والكشيدة وتعدد الفراغات، والموضع على النص الأصلي", () => {
  const r = verifyQuote(text, 0, text.length, "وحيث إن الغبن الفاحش لا يثبت");
  assert.ok(r.ok);
  if (r.ok) assert.ok(text.slice(r.at).startsWith("وحيـــث"));
});

test("اقتباس غير موجود حرفيًّا يُرفض (لا اختلاق)", () => {
  assert.deepEqual(verifyQuote(text, 0, text.length, "وحيث إن الغبن اليسير لا يثبت"), { ok: false, reason: "not_found" });
  assert.deepEqual(verifyQuote(text, 0, text.length, "وحيث إن"), { ok: false, reason: "too_short" });
  assert.deepEqual(verifyQuote(text, 0, text.length, "المدعي [اسم] لم يقدم بينة"), { ok: false, reason: "masked" });
});

test("الاقتباس خارج المنطقة لا يُقبل", () => {
  const start = text.indexOf("لذلك");
  assert.equal(verifyQuote(text, start, text.length, "وحيث إن الغبن الفاحش لا يثبت").ok, false);
});

test("قراءة رد النموذج", () => {
  assert.deepEqual(parseAnswer('{"found": true, "start_quote": "وحيث إن الغبن"}'), { found: true, quote: "وحيث إن الغبن" });
  assert.deepEqual(parseAnswer('النتيجة: {"found": false, "start_quote": ""}'), { found: false, quote: null });
  assert.equal(parseAnswer("لا أعرف"), null);
});

test("المنطقة المرسلة محجوبة ومسقوفة", () => {
  const r = regionInput("المدعي/ سعد الدوسري هويته 1012345678 " + "س ".repeat(8000), 0, 16100);
  assert.ok(r.capped);
  assert.ok(!r.input.includes("1012345678"));
  assert.ok(!r.input.includes("سعد الدوسري"));
});
