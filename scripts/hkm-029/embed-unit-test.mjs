/**
 * HKM-029 — اختبارات وحدة لأداة المتجهات المحصورة (بلا قاعدة ولا شبكة).
 *   npm run test:hkm-029-embed
 */
import {
  EMBED_DIMS,
  assertEmbedManifest,
  assertSummaryMatches,
  assertVectors,
  chunk,
  embedTargetGate,
  parseEmbedArgs,
  workflowArgsToRun,
} from "./embed-lib.mjs";
import { readFileSync } from "node:fs";

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

const M = { task: "HKM-029", kind: "embeddings", model: "text-embedding-3-small", selected: 3, stale: 2, missing: 1, ids_md5: "a".repeat(32), state_md5: "b".repeat(32) };
ok(assertEmbedManifest({ ...M }) !== null, "قائمة صالحة تمر");
throws(() => assertEmbedManifest({ ...M, selected: 4 }), /القديمة/, "العدد لا يساوي القديمة + المفقودة");
throws(() => assertEmbedManifest({ ...M, model: "other" }), /النموذج/, "نموذج آخر مرفوض");
throws(() => assertEmbedManifest({ ...M, ids_md5: "x" }), /ids_md5/, "بصمة معرّفات غير صالحة");
throws(() => assertEmbedManifest({ ...M, selected: 0, stale: 0, missing: 0 }), /فارغة/, "قائمة فارغة مرفوضة");
const real = assertEmbedManifest(JSON.parse(readFileSync(new URL("./embed-manifest.json", import.meta.url), "utf8")));
ok(real.selected === 940 && real.stale === 938 && real.missing === 2, "القائمة المحفوظة: 940 = 938 قديمة + 2 مفقودة");
ok(Object.values(real.by_law).reduce((a, b) => a + b, 0) === real.selected, "القائمة المحفوظة: مجموع الأنظمة = العدد");

const live = { selected: 3, stale: 2, missing: 1, ids_md5: "a".repeat(32), state_md5: "b".repeat(32) };
ok(assertSummaryMatches(M, live), "الاختيار الحي المطابق يمر");
for (const k of ["selected", "stale", "missing", "ids_md5", "state_md5"]) {
  throws(() => assertSummaryMatches(M, { ...live, [k]: k.endsWith("md5") ? "c".repeat(32) : 9 }), new RegExp(k), `اختلاف ${k} يوقف الكل`);
}

const PROD = "postgresql://u:p@ep-icy-rice-x-pooler.c-2.us-east-1.aws.neon.tech/neondb";
const OPEN = { CONFIRM_RUNTIME_DB_ALIGNMENT: "NEON_RUNTIME_CONFIRMED" };
ok(embedTargetGate(PROD, { env: {} }).target === "production", "التجريب على الإنتاج بلا إذن كتابة");
throws(() => embedTargetGate(PROD, { apply: true, approvedRows: 940, expected: 940, env: {} }), /CONFIRM/, "الكتابة بلا CONFIRM مرفوضة");
throws(() => embedTargetGate(PROD, { apply: true, approvedRows: 939, expected: 940, env: OPEN }), /العدد المعتمد/, "عدد معتمد مختلف مرفوض");
throws(() => embedTargetGate(PROD, { apply: true, approvedRows: null, expected: 940, env: OPEN }), /العدد المعتمد/, "بلا عدد معتمد مرفوض");
ok(embedTargetGate(PROD, { apply: true, approvedRows: 940, expected: 940, env: OPEN }).target === "production", "الكتابة على الإنتاج بالشرطين");
throws(() => embedTargetGate("postgresql://u:p@ep-other.c-2.neon.tech/neondb", { env: {} }), /مرفوض/, "مضيف آخر مرفوض");
throws(() => embedTargetGate(`${PROD}?host=ep-other.c-2.us-east-1.aws.neon.tech`, { env: {} }), /مرفوض/, "?host= إلى فرع آخر مرفوض");
throws(() => embedTargetGate(PROD.replace("/neondb", "/other"), { env: {} }), /مرفوض/, "قاعدة غير neondb مرفوضة");
throws(() => embedTargetGate("postgresql://u:p@ep-icy-rice.evil.com/neondb", { env: {} }), /مرفوض/, "ep-icy-rice بلا .neon.tech مرفوض");
ok(embedTargetGate("postgresql://u@127.0.0.1:54330/hakeem_hkm029_embed_test", { apply: true, env: {} }).target === "isolated", "المعزول يقبل 127.0.0.1 وقاعدته");
throws(() => embedTargetGate("postgresql://u@127.0.0.1:54330/neondb", { env: {} }), /مرفوض/, "المحلي بقاعدة أخرى مرفوض");
throws(() => embedTargetGate(PROD, { env: { EMBEDDING_MODEL: "text-embedding-3-large" } }), /النموذج/, "EMBEDDING_MODEL آخر مرفوض");

ok(JSON.stringify(parseEmbedArgs(["--apply", "--approved-rows", "940"])) === JSON.stringify({ apply: true, approvedRows: 940, manifest: null }), "وسائط الكتابة");
ok(parseEmbedArgs(["--approved-rows", "9x"]).approvedRows === null && !parseEmbedArgs([]).apply, "عدد غير رقمي = null، والافتراضي تجريب");
ok(workflowArgsToRun(["--target", "rulings"]) === null && workflowArgsToRun([]) === null, "المسار: غير المواد لا يُحوَّل");
ok(JSON.stringify(workflowArgsToRun(["--target", "articles"])) === JSON.stringify({ apply: false, approvedRows: null }), "المسار: scope=missing تجريب");
ok(JSON.stringify(workflowArgsToRun(["--target", "articles", "--all", "--limit", "940"])) === JSON.stringify({ apply: true, approvedRows: 940 }), "المسار: scope=all مع limit = كتابة بالعدد المعتمد");

const v = Array.from({ length: EMBED_DIMS }, (_, i) => i / EMBED_DIMS);
ok(assertVectors([v, v], 2), "متجهان صالحان");
throws(() => assertVectors([v, null], 2), /الموضع 1/, "متجه null يوقف الكل");
throws(() => assertVectors([v.slice(1)], 1), /الموضع 0/, "طول غير 1536 يوقف الكل");
throws(() => assertVectors([[...v.slice(1), Number.NaN]], 1), /الموضع 0/, "قيمة غير منتهية توقف الكل");
throws(() => assertVectors([v], 2), /≠/, "عدد ناقص يوقف الكل");
ok(JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === "[[1,2],[3,4],[5]]", "التقسيم إلى دفعات");

console.log(failed === 0 ? "✓ HKM-029 المتجهات (وحدة)" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
