/**
 * test-rulings-retrieval — اختبارات نقية لاستعلام الأحكام ومقتطفاتها (بلا قاعدة).
 *   npm run test:rulings-retrieval
 */
import assert from "node:assert/strict";
import { buildRulingExcerpts, buildRulingTsQuery, findMatches, matchKey, queryTokens, tokenVariants } from "../lib/modules/legal-core/ruling-excerpts";
import { buildSegmentChunks, keepEnds, segmentContentHash, windows } from "../lib/rulings/research/segment-embeddings";
import { boundaryRegions, segmentRows } from "../lib/rulings/research/segment-store";

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

check("متجهات الأجزاء: الأسباب والمنطوق فقط، بلا ديباجة", () => {
  const cs = buildSegmentChunks(ruling);
  assert.deepEqual(cs.map((c) => c.part), ["reasons", "disposition"]);
  for (const c of cs) assert.ok(!c.input.includes("الحمد لله"), c.input);
  assert.ok(cs[0].input.startsWith("وحيث إن الغبن"), cs[0].input);
  assert.ok(cs[1].input.startsWith("لذلك حكمت الدائرة"), cs[1].input);
  assert.equal(ruling.slice(cs[0].start, cs[0].end).replace(/\s+/g, " ").trim(), cs[0].input, "الإزاحات على النص الأصلي");
});

check("متجهات الأجزاء: الحجب يطبَّق على المرسَل لا على الإزاحات", () => {
  const cs = buildSegmentChunks(ruling, (s) => s.replace(/المدعي/g, "[محجوب]"));
  assert.ok(cs[0].input.includes("[محجوب]"));
  assert.ok(ruling.slice(cs[0].start, cs[0].end).includes("المدعي"));
});

check("نوافذ الأسباب الطويلة متجاورة على حدود الكلمات، ويُبقى أولها وآخرها", () => {
  const long = Array.from({ length: 3000 }, (_, i) => `كلمة${i}`).join(" ");
  const ws = windows(long, 0, long.length, 6000);
  assert.ok(ws.length > 4);
  for (const [s, e] of ws) assert.ok(e - s <= 6000 && (e === long.length || long[e] === " "));
  assert.deepEqual(keepEnds([1, 2, 3, 4, 5, 6], 4), [1, 2, 5, 6]);
  assert.deepEqual(keepEnds([1, 2], 4), [1, 2]);
});

check("بصمة المتجه تتغير بالنموذج والنص", () => {
  assert.notEqual(segmentContentHash("أ", "m1"), segmentContentHash("أ", "m2"));
  assert.equal(segmentContentHash("أ", "m1"), segmentContentHash("أ", "m1"));
});

check("صفوف الأجزاء: متجاورة، وفهرسة لفظية للأسباب والمنطوق فقط", () => {
  const rows = segmentRows("r1", ruling);
  assert.deepEqual(rows.map((r) => r.part), ["header", "claims", "defense", "reasons", "disposition", "other"]);
  for (const r of rows) assert.equal(Boolean(r.part_norm), r.part === "reasons" || r.part === "disposition", r.part);
  assert.ok(rows.find((r) => r.part === "reasons")!.part_norm!.includes("الغبن"));
  assert.equal(new Set(rows.map((r) => r.content_hash)).size, 1);
});

check("مناطق الحدود: لا شيء للحكم المكتمل، ومنطقة الأسباب وحدها عند فقدها", () => {
  assert.deepEqual(boundaryRegions(ruling), []);
  const noReasons = ruling.replace("وحيث إن", "إذ إن").replace("ولما كان", "وإذ كان");
  const regions = boundaryRegions(noReasons);
  assert.deepEqual(regions.map((r) => r.missing), ["reasons"]);
  const r = regions[0];
  assert.ok(noReasons.slice(r.start, r.end).startsWith("فأجاب قائلا"), noReasons.slice(r.start, r.start + 30));
  assert.ok(noReasons.slice(r.end).startsWith("لذلك حكمت"));
});

console.log(failed === 0 ? "✓ استعلام الأحكام ومقتطفاتها" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
