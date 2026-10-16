/**
 * test-rulings-retrieval — اختبارات نقية لاستعلام الأحكام ومقتطفاتها (بلا قاعدة).
 *   npm run test:rulings-retrieval
 */
import assert from "node:assert/strict";
import { buildRulingExcerpts, buildRulingTsQuery, findMatches, matchKey, queryTokens, tokenVariants } from "../lib/modules/legal-core/ruling-excerpts";

let failed = 0;
const check = (name: string, fn: () => void) => {
  try {
    fn();
    console.log("✓ " + name);
  } catch (e) {
    failed++;
    console.error("✗ " + name + " — " + (e as Error).message);
  }
};

const ruling =
  "الحمد لله وحده أما بعد فلدى الدائرة التجارية الأولى وبناء على القضية المحالة " +
  "تتحصل وقائع هذه الدعوى في أن المدعي يطلب فسخ العقد للغبن الفاحش وإلزام المدعى عليه بالتعويض " +
  "فأجاب قائلا إن العقد صحيح ولا غبن فيه " +
  "وحيث إن الغبن الفاحش لا يثبت إلا بالبينة ولما كان المدعي لم يقدم ما يثبت الغبن فإن طلب الفسخ لا يقوم على أساس " +
  "لذلك حكمت الدائرة برفض الدعوى " +
  "وصلى الله وسلم على نبينا محمد";

check("كلمات الوقف تُحذف", () => {
  assert.deepEqual(queryTokens("هل يجوز فسخ العقد في الغبن"), ["فسخ", "العقد", "الغبن"]);
});

check("صيغ اللفظ تشمل السوابق والتطبيعين", () => {
  const v = tokenVariants("الغبن");
  for (const f of ["الغبن", "غبن", "بالغبن", "للغبن", "والغبن"]) assert.ok(v.includes(f), f);
  const h = tokenVariants("القضاء");
  assert.ok(h.includes("القضاء") && h.includes("القضا"), "الهمزة بالتطبيعين");
});

check("tsquery: AND بين الألفاظ وOR بين الصيغ", () => {
  const q = buildRulingTsQuery("فسخ العقد")!;
  assert.match(q, /^\(.*فسخ.*\) & \(.*العقد.*\)$/);
  assert.equal(buildRulingTsQuery("في من"), null);
  assert.ok(!/[:'"!&|()<>]/.test(q.replace(/[()&|]/g, "").replace(/ /g, "")), "لا رموز خارج البنية");
});

check("المطابقة كلمة كاملة: «نجش» لا تطابق «سونجشانج»", () => {
  assert.equal(findMatches("شركة سونجشانج المحدودة", "نجش").length, 0);
  assert.equal(findMatches("ثبت النجش في البيع", "نجش").length, 1);
  assert.equal(findMatches("وقع بالغبن الفاحش", "الغبن").length, 1);
});

check("الخريطة تعيد المواضع إلى النص الأصلي رغم التشكيل والكشيدة", () => {
  const raw = "حكمت المحكمـــة بفَسْخ العقد";
  const pos = findMatches(raw, "فسخ")[0];
  assert.equal(raw.slice(pos, pos + "بفَسْخ".length), "بفَسْخ");
  assert.equal(matchKey("إلى").key, "الي");
});

check("المقتطف من الأسباب لا من الديباجة", () => {
  const ex = buildRulingExcerpts(ruling, "الغبن");
  assert.equal(ex.matchedIn, "reasons");
  assert.ok(ex.snippet.includes("لا يثبت إلا بالبينة"), ex.snippet);
  assert.ok(!ex.snippet.includes("الحمد لله"), ex.snippet);
});

check("المنطوق مرفق دائمًا", () => {
  const ex = buildRulingExcerpts(ruling, "الغبن");
  assert.ok(ex.disposition?.startsWith("لذلك حكمت الدائرة"), ex.disposition ?? "");
});

check("بلا مطابقة: بداية الأسباب لا الديباجة", () => {
  const ex = buildRulingExcerpts(ruling, "كمبيالة");
  assert.equal(ex.matchedIn, "reasons");
  assert.ok(!ex.snippet.includes("الحمد لله"));
});

check("خريطة الأجزاء متجاورة تغطي النص", () => {
  const ex = buildRulingExcerpts(ruling, "");
  assert.equal(ex.parts[0].start, 0);
  assert.equal(ex.parts[ex.parts.length - 1].end, ruling.length);
  assert.deepEqual(ex.parts.map((p) => p.type), ["header", "claims", "defense", "reasons", "disposition", "other"]);
});

console.log(failed === 0 ? "✓ استعلام الأحكام ومقتطفاتها" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
