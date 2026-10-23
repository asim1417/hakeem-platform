import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSegmentChunks, windows } from "../segment-embeddings";
import { maskPersonalData } from "../mask";

test("النافذة تُقطع عند نهاية جملة في نصفها الثاني لا داخل اسم", () => {
  const text = "أ".repeat(60) + ". حضر سالم بن فهد الحربي وادعى" + " ب".repeat(30);
  const [[s, e]] = windows(text, 0, text.length, 80);
  assert.equal(s, 0);
  assert.equal(text.slice(0, e).trimEnd().at(-1), ".");
});

test("بلا نهاية جملة: القطع عند آخر فراغ كما كان", () => {
  const text = "كلمة ".repeat(40);
  const ws = windows(text, 0, text.length, 50);
  assert.ok(ws.length > 1);
  for (const [, e] of ws.slice(0, -1)) assert.ok(text[e] === " " || e === text.length);
});

test("مدخل المتجه محجوبة أسماؤه وأرقامه بـ maskPersonalData", () => {
  const raw =
    "الوقائع: تتلخص في أن المدعي يطالب بالتعويض.\nالأسباب: وحيث حضر سالم بن فهد الحربي هوية رقم 1012345678 وأقر بالمبلغ فإن الدعوى ثابتة. " +
    "\nنص الحكم: حكمت الدائرة بإلزام المدعى عليه بالمبلغ.";
  const chunks = buildSegmentChunks(raw, maskPersonalData);
  assert.ok(chunks.length > 0);
  for (const c of chunks) {
    assert.ok(!c.input.includes("الحربي") && !c.input.includes("1012345678"), c.input);
  }
});
