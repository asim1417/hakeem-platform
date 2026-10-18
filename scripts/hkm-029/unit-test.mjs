/**
 * HKM-029 — اختبارات وحدة بلا قاعدة: التصنيف، والقائمة المجمّدة، والحراس، وبوابة الهدف، وحالات المتجه وOpenSearch.
 *   npm run test:hkm-029
 */
import { readFileSync } from "node:fs";
import {
  DEFAULT_SCOPE,
  assertLockedRows,
  assertManifest,
  assertTarget,
  buildManifest,
  classifyDrift,
  classifyObservation,
  ledgerBatchId,
  md5,
  openSearchStatus,
  summarizeDrift,
  vectorStatus,
} from "./drift-lib.mjs";

let failed = 0;
const ok = (c, m) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (!c) failed++;
};
const throws = (fn, re, m) => {
  try {
    fn();
    ok(false, m);
  } catch (e) {
    ok(re.test(String(e.message)), m);
  }
};

const L = "نظام تجريبي";
const rows = [
  { id: "a1", lawName: L, articleNumber: 1, articleBis: 0, stored: "نص الاولي", expected: "نص الاولي" },
  { id: "a2", lawName: L, articleNumber: 2, articleBis: 0, stored: "نص الثالثه", expected: "نص الثانيه" },
  { id: "a3", lawName: L, articleNumber: 3, articleBis: 0, stored: "نص الرابعه", expected: "نص الثالثه" },
  { id: "a4", lawName: L, articleNumber: 4, articleBis: 0, stored: "نص  الرابعه ", expected: "نص الرابعه" },
  { id: "a5", lawName: L, articleNumber: 5, articleBis: 0, stored: "نص قديم", expected: "نص الخامسه" },
  { id: "a6", lawName: L, articleNumber: 6, articleBis: 0, stored: null, expected: "نص السادسه" },
  { id: "b1", lawName: "نظام آخر", articleNumber: 1, articleBis: 0, stored: "نص الثانيه", expected: "نص اخر" },
];
const drift = classifyDrift(rows);
const by = Object.fromEntries(drift.map((d) => [d.id, d]));
ok(!by.a1, "المطابق لا يُعدّ منحرفًا");
ok(by.a2?.category === "shifted" && by.a2.matchesArticle.number === 3, "shifted: المخزَّن فهرس المادة 3 (يُذكر رقمها)");
ok(by.a3?.category === "shifted" && by.a3.matchesArticle.number === 4, "shifted: المادة 3 تحمل فهرس 4");
ok(by.a4?.category === "whitespace_only", "whitespace_only: يزول الفرق بتوحيد المسافات");
ok(by.a5?.category === "content_changed", "content_changed: فرق لا يطابق مادة أخرى");
ok(by.a6?.category === "empty", "empty: فهرس فارغ (من شأن HKM-002)");
ok(by.b1?.category === "content_changed", "المطابقة لمادة في نظام آخر لا تُعدّ انزياحًا");
const sum = summarizeDrift(drift);
ok(sum.total === 6 && sum.byCategory.shifted === 2 && sum.byLaw[L].whitespace_only === 1, "الأعداد لكل فئة ونظام");

const dbRows = rows.map((r) => ({ id: r.id, lawName: r.lawName, articleNumber: r.articleNumber, articleBis: 0, content: `متن ${r.id}`, search_norm: r.stored }));
const manifest = buildManifest({ drift, rows: dbRows, source: "test", frozenAt: "2026-10-18T00:00:00Z" });
ok(manifest.expected_count === 4 && manifest.rows.every((r) => DEFAULT_SCOPE.includes(r.category)), "القائمة المجمّدة: shifted وcontent_changed فقط افتراضيًّا (4)");
ok(!JSON.stringify(manifest).includes("متن"), "القائمة بلا نصوص");
ok(buildManifest({ drift, rows: dbRows, scope: ["whitespace_only"], source: "t", frozenAt: "t" }).expected_count === 1, "whitespace_only بقرار صريح فقط");
throws(() => assertManifest({ ...manifest, expected_count: 3 }), /العدد/, "عدد لا يطابق الصفوف يُرفض");
throws(() => assertManifest({ ...manifest, rows: manifest.rows.slice(1) }), /العدد/, "حذف معرّف من القائمة دون تعديل العدد يُرفض");
throws(() => assertManifest({ ...manifest, rows: [...manifest.rows.slice(1), manifest.rows[1]] }), /مكرر/, "معرّف مكرر يُرفض");

const locked = manifest.rows.map((m) => ({ id: m.id, lawName: m.lawName, articleNumber: m.articleNumber, articleBis: 0, content_md5: m.content_md5, search_norm_md5: m.search_norm_md5 }));
ok(assertLockedRows(manifest, locked), "الصفوف المقفلة المطابقة تمر");
throws(() => assertLockedRows(manifest, locked.slice(1)), /العدد/, "صف غائب يوقف الكل");
throws(() => assertLockedRows(manifest, locked.map((r, i) => (i === 0 ? { ...r, content_md5: md5("x") } : r))), /نص/, "تغيّر المتن يوقف الكل");
throws(() => assertLockedRows(manifest, locked.map((r, i) => (i === 0 ? { ...r, search_norm_md5: md5("x") } : r))), /الفهرس/, "تغيّر الفهرس منذ التجميد يوقف الكل");
throws(() => assertLockedRows(manifest, locked.map((r, i) => (i === 0 ? { ...r, articleNumber: 99 } : r))), /رقم/, "تغيّر الرقم يوقف الكل");

const ledger = { batch: "HKM-029", target: "isolated", database: "hakeem_hkm029", expected_count: 2, rows: [{ id: "x", old_search_norm: "ق", new_search_norm: "ج" }, { id: "y", old_search_norm: null, new_search_norm: "ج2" }] };
ok(/^[0-9a-f]{64}$/.test(ledgerBatchId(ledger)) && ledgerBatchId(ledger) !== ledgerBatchId({ ...ledger, target: "production" }), "معرّف الدفعة مرتبط بالهدف والقيم");
ok(classifyObservation(ledger, [{ id: "x", search_norm: "ج" }, { id: "y", search_norm: "ج2" }]).outcome === "confirmed", "verify: confirmed");
ok(classifyObservation(ledger, [{ id: "x", search_norm: "ق" }, { id: "y", search_norm: null }]).outcome === "not_applied", "verify: not_applied");
ok(classifyObservation(ledger, [{ id: "x", search_norm: "ج" }, { id: "y", search_norm: null }]).outcome === "unconfirmed", "verify: خليط = unconfirmed");
ok(classifyObservation(ledger, [{ id: "x", search_norm: "ج" }]).outcome === "unconfirmed", "verify: صف غائب = unconfirmed");

throws(() => assertTarget("isolated", "postgresql://u:p@db.example.com:5432/hakeem_hkm029", 4, {}), /المعزول/, "المعزول يرفض مضيفًا بعيدًا");
ok((() => { assertTarget("isolated", "postgresql://u:p@127.0.0.1:54329/hakeem_hkm029", 4, {}); return true; })(), "المعزول يقبل 127.0.0.1");
const prodUrl = "postgresql://u:p@ep-icy-rice-x.c-2.us-east-1.aws.neon.tech/neondb";
throws(() => assertTarget("production", prodUrl, 4, {}), /غير مفتوح/, "الإنتاج مرفوض بلا إذن");
throws(() => assertTarget("production", prodUrl, 4, { HAKEEM_INJECT: "yes", HAKEEM_INDEX_APPLY: "yes", HAKEEM_APPROVED_ROWS: "5" }), /غير مفتوح/, "الإنتاج مرفوض بعدد لا يطابق القائمة");
throws(() => assertTarget("production", "postgresql://u:p@ep-other.neon.tech/neondb", 4, { HAKEEM_INJECT: "yes", HAKEEM_INDEX_APPLY: "yes", HAKEEM_APPROVED_ROWS: "4" }), /غير مفتوح/, "الإنتاج مرفوض على مضيف آخر");
ok((() => { assertTarget("production", prodUrl, 4, { HAKEEM_INJECT: "yes", HAKEEM_INDEX_APPLY: "yes", HAKEEM_APPROVED_ROWS: "4" }); return true; })(), "الإنتاج يُفتح بالحراس الثلاثة والمضيف");

ok(vectorStatus(null, "a", "b") === "missing" && vectorStatus("a", "a", "b") === "fresh" && vectorStatus("b", "a", "b") === "fresh_legacy" && vectorStatus("c", "a", "b") === "stale", "حالات المتجه الأربع");
const row = { title: "المادة 1", content: "نص", articleNumber: 1 };
ok(openSearchStatus(null, row) === "missing" && openSearchStatus({ ...row }, row) === "fresh" && openSearchStatus({ ...row, articleNumber: 2 }, row) === "stale" && openSearchStatus({ ...row, content: "نص آخر" }, row) === "stale", "حالات مستند OpenSearch");

const frozen = assertManifest(JSON.parse(readFileSync(new URL("./expected-drift-ids.json", import.meta.url), "utf8")));
ok(frozen.expected_count === frozen.rows.length, `القائمة المجمّدة المحفوظة متسقة (${frozen.expected_count} صفًّا)`);

console.log(failed === 0 ? "✓ HKM-029 (وحدة)" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
