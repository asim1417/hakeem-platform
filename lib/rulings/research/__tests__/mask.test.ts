import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPersonalData } from "../mask";

test("سلسلة النسب تُحجب", () => {
  const out = maskPersonalData("حضر محمد بن عبدالله بن سعد القحطاني وادعى");
  assert.ok(!out.includes("عبدالله"), out);
  assert.ok(!out.includes("القحطاني"), out);
  assert.ok(out.includes("[اسم]"));
  assert.ok(out.includes("وادعى"));
});

test("الاسم بعد صفة الطرف يُحجب وتبقى الصفة", () => {
  const out = maskPersonalData("المدعي/ سعد فهد الدوسري بأن المدعى عليه لم يسدد");
  assert.ok(out.startsWith("المدعي/ [اسم]"), out);
  assert.ok(!out.includes("الدوسري"), out);
  assert.ok(out.includes("بأن المدعى عليه لم يسدد"), out);
});

test("الصفة بلا اسم لا تُمسّ", () => {
  const s = "وحيث إن المدعي بأن المدعى عليه على ذلك";
  assert.equal(maskPersonalData(s), s);
});

test("أسماء الشركات والجهات لا تُحجب", () => {
  const s = "المدعى عليها شركة الراجحي للتجارة";
  assert.equal(maskPersonalData(s), s);
});

test("أرقام المواد والتواريخ تبقى، والهوية والجوال تُحجب", () => {
  const out = maskPersonalData("استنادًا إلى المادة 18 بتاريخ 1443/5/12 هوية 1012345678 جوال 0501234567");
  assert.ok(out.includes("المادة 18"));
  assert.ok(out.includes("1443/5/12"));
  assert.ok(!out.includes("1012345678"));
  assert.ok(!out.includes("0501234567"));
});

test("الوكيل والمحامي", () => {
  const out = maskPersonalData("وحضر وكيله المحامي خالد عبدالرحمن العتيبي بموجب الوكالة");
  assert.ok(!out.includes("العتيبي"), out);
  assert.ok(out.includes("بموجب الوكالة"), out);
  assert.ok(out.includes("وكيله المحامي [اسم]"), out);
});
