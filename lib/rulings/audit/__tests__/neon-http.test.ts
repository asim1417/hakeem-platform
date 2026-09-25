import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRows, parseValue, serializeParam } from "../neon-http";

test("تسلسل المعاملات: المصفوفات بصيغة PostgreSQL مع تهريب", () => {
  assert.equal(serializeParam(["a", "b"]), '{"a","b"}');
  assert.equal(serializeParam(['x"y', "z\\w"]), '{"x\\"y","z\\\\w"}');
  assert.equal(serializeParam([]), "{}");
  assert.equal(serializeParam(null), null);
  assert.equal(serializeParam(42), "42");
  assert.equal(serializeParam("%فسخ%"), "%فسخ%");
});

test("تحويل القيم بحسب نوع العمود", () => {
  assert.equal(parseValue("t", 16), true);
  assert.equal(parseValue("f", 16), false);
  assert.equal(parseValue("51105", 20), 51105);
  assert.equal(parseValue("0.5", 701), 0.5);
  assert.deepEqual(parseValue('{"a":1}', 3802), { a: 1 });
  assert.equal(parseValue("نص", 25), "نص");
  assert.equal(parseValue(null, 20), null);
});

test("تحويل الصفوف", () => {
  const rows = parseRows(
    [{ name: "id", dataTypeID: 25 }, { name: "n", dataTypeID: 20 }, { name: "ok", dataTypeID: 16 }],
    [{ id: "c1", n: "3", ok: "t" }],
  );
  assert.deepEqual(rows, [{ id: "c1", n: 3, ok: true }]);
});
