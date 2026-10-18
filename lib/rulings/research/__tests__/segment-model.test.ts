import { test } from "node:test";
import assert from "node:assert/strict";
import { applyModelBoundary, parseAnswer, regionInput, verifyQuote } from "../segment-model";

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

test("اقتباس فيه اسم محجوب: تُقبل الكلمات التي قبله إن كفت", () => {
  const t = "وحيث إن المدعي سعد بن علي لم يقدم بينة على دعواه";
  const r = verifyQuote(t, 0, t.length, "وحيث إن المدعي يطالب [اسم] لم يقدم");
  assert.equal(r.ok, false); // «يطالب» ليست في النص: لا اختلاق
  const ok = verifyQuote("وحيث إن الدعوى المقامة من المدعي سعد", 0, 38, "وحيث إن الدعوى المقامة [اسم]");
  assert.ok(ok.ok);
  assert.deepEqual(verifyQuote(t, 0, t.length, "وحيث [اسم] لم يقدم بينة"), { ok: false, reason: "masked" });
});

test("إدخال حدّ النموذج يقسم الجزء ويحفظ الترتيب، ويرفض ما يكسره", () => {
  const segs = [
    { type: "header" as const, start: 0, end: 10 },
    { type: "claims" as const, start: 10, end: 100 },
    { type: "disposition" as const, start: 100, end: 120 },
  ];
  const r = applyModelBoundary(segs, "reasons", 60)!;
  assert.deepEqual(r.map((s) => [s.type, s.start, s.end]), [["header", 0, 10], ["claims", 10, 60], ["reasons", 60, 100], ["disposition", 100, 120]]);
  assert.equal(applyModelBoundary(segs, "claims", 110), null); // دعوى بعد المنطوق
  assert.equal(applyModelBoundary(segs, "reasons", 10), null); // على بداية جزء قائم
});
