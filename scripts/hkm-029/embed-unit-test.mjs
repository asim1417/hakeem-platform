/**
 * HKM-029 — اختبارات وحدة لأداة المتجهات المحصورة (بلا قاعدة ولا شبكة).
 *   npm run test:hkm-029-embed
 */
import {
  EMBED_BATCH,
  EMBED_DIMS,
  ROWS_SQL,
  STATE_FOR_IDS_SQL,
  SUMMARY_SQL,
  assertEmbedManifest,
  assertSummaryMatches,
  assertVectors,
  buildEmbedManifest,
  chunk,
  chunkByChars,
  embedTargetGate,
  embedWithRetry,
  parseEmbedArgs,
  workflowArgsToRun,
} from "./embed-lib.mjs";
import { main as freezeMain, parseFreezeArgs, summaryFromInput } from "./freeze-manifest.mjs";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

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
ok(assertEmbedManifest({ ...M, task: "HKM-030" }) !== null, "قائمة HKM-030 تمر");
throws(() => assertEmbedManifest({ ...M, task: "HKM-031" }), /غير صالحة/, "مهمة أخرى مرفوضة");
const real = assertEmbedManifest(JSON.parse(readFileSync(new URL("./embed-manifest.json", import.meta.url), "utf8")));
ok(real.selected === real.stale + real.missing && real.selected >= 1, `القائمة المحفوظة (${real.task}): ${real.selected} = ${real.stale} قديمة + ${real.missing} مفقودة`);
ok(!real.by_law || Object.values(real.by_law).reduce((a, b) => a + b, 0) === real.selected, "القائمة المحفوظة: مجموع الأنظمة = العدد (إن وُجد)");

// الاختيار (HKM-030): النص الساري من unit_version، وكل القديمة والمفقودة، بلا المادتين المحددتين.
ok(/LEFT JOIN LATERAL[\s\S]*unit_version uv[\s\S]*uv\.valid_from <= now\(\)[\s\S]*ORDER BY uv\.valid_from DESC LIMIT 1/.test(SUMMARY_SQL), "SUMMARY_SQL: أحدث نسخة سارية (valid_from <= now())");
ok(SUMMARY_SQL.includes("coalesce(uv.body, a.content)"), "SUMMARY_SQL: السقوط إلى content بلا نسخة");
ok(SUMMARY_SQL.includes("WHERE status IN ('stale', 'missing')") && !SUMMARY_SQL.includes("n IN (19, 26)"), "SUMMARY_SQL: كل القديمة والمفقودة، لا 19 و26 فقط");
ok(SUMMARY_SQL.includes(`a."articleBis" < 100`), "SUMMARY_SQL: الصفوف غير المادية (articleBis >= 100) خارج النطاق");
ok(SUMMARY_SQL.includes("|| E'\\n' || 'text-embedding-3-small'") && SUMMARY_SQL.includes("replace(a.t, 'ـ', '')"), "SUMMARY_SQL: البصمات cur/leg/vfp كما كانت");
ok(ROWS_SQL.includes("sel.body AS content"), "ROWS_SQL: content للكود = النص الساري");
ok(STATE_FOR_IDS_SQL.includes("unit_version uv") && STATE_FOR_IDS_SQL.includes("coalesce(uv.body, a.content)") && STATE_FOR_IDS_SQL.includes("ANY($1::text[])"), "STATE_FOR_IDS_SQL: بصمة الحالة بالنص الساري");

// التجميد من صف SUMMARY_SQL.
const S = { selected: "12000", stale: 600, missing: 11400, ids_md5: "c".repeat(32), state_md5: "d".repeat(32) };
const built = buildEmbedManifest(S, { chars: 3_000_000, now: new Date("2026-10-22T10:00:00Z") });
ok(built.task === "HKM-030" && built.kind === "embeddings" && built.model === "text-embedding-3-small" && built.selected === 12000 && built.chars === 3_000_000 && built.frozen_at === "2026-10-22T10:00:00Z", "buildEmbedManifest: HKM-030 بالأرقام والنموذج والوقت");
ok(built.approval === "المالك 22/10/2026: «نفذها كلها»", "buildEmbedManifest: نص الاعتماد");
throws(() => buildEmbedManifest({ ...S, stale: 601 }), /القديمة/, "buildEmbedManifest: مجموع غير متسق مرفوض");
throws(() => buildEmbedManifest({ ...S, selected: "x" }), /selected/, "buildEmbedManifest: عدد غير رقمي مرفوض");
throws(() => buildEmbedManifest(S, { chars: -1 }), /chars/, "buildEmbedManifest: chars سالب مرفوض");
ok(assertSummaryMatches(built, { ...S, selected: 12000 }), "القائمة المجمّدة تطابق الصف الذي بُنيت منه");
ok(JSON.stringify(summaryFromInput(JSON.stringify([S]))) === JSON.stringify(S) && JSON.stringify(summaryFromInput(JSON.stringify({ rows: [S] }))) === JSON.stringify(S), "summaryFromInput: مصفوفة بصف واحد أو rows");
throws(() => summaryFromInput("[]"), /صفًا واحدًا/, "summaryFromInput: بلا صف مرفوض");
throws(() => summaryFromInput("{"), /JSON/, "summaryFromInput: نص غير JSON مرفوض");
ok(parseFreezeArgs(["--chars", "5"]).chars === 5 && parseFreezeArgs([]).chars === null && parseFreezeArgs(["--print-summary-sql"]).printSql, "parseFreezeArgs");
throws(() => parseFreezeArgs(["--chars", "x"]), /--chars/, "parseFreezeArgs: chars غير رقمي مرفوض");
const outFile = path.join(mkdtempSync(path.join(tmpdir(), "hkm030-")), "manifest.json");
const frozen = freezeMain(["--out", outFile, "--chars", "7"], () => JSON.stringify(S));
const reread = assertEmbedManifest(JSON.parse(readFileSync(outFile, "utf8")));
ok(frozen.selected === 12000 && reread.task === "HKM-030" && reread.chars === 7 && reread.ids_md5 === S.ids_md5 && reread.state_md5 === S.state_md5, "freeze-manifest: يكتب قائمة صالحة تُقرأ بالبوابة نفسها");

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

// دفعات بسقف العدد والحروف (~12 ألف صف).
const many = Array.from({ length: 12_000 }, (_, i) => ({ i, text: "ن".repeat(300) }));
const byCount = chunkByChars(many);
ok(byCount.length === Math.ceil(12_000 / EMBED_BATCH) && byCount.every((b) => b.length <= EMBED_BATCH) && byCount.flat().length === 12_000 && byCount.flat().every((x, i) => x.i === i), "chunkByChars: 12 ألف صف بسقف 96 والترتيب محفوظ");
ok(JSON.stringify(chunkByChars([{ text: "a".repeat(6000) }, { text: "b".repeat(6000) }, { text: "c".repeat(3000) }, { text: "d".repeat(3000) }], 96, 10_000).map((b) => b.length)) === "[1,2,1]", "chunkByChars: سقف الحروف يقسم الدفعة");
ok(JSON.stringify(chunkByChars([{ text: "a".repeat(20_000) }, { text: "b" }], 96, 10_000).map((b) => b.length)) === "[1,1]", "chunkByChars: العنصر الأكبر من السقف يُرسل وحده");
ok(chunkByChars([], 96, 10).length === 0, "chunkByChars: بلا عناصر = بلا دفعات");

// إعادة محاولة الدفعة الفاشلة (null) بتراجع، بلا كتابة.
const v1 = Array.from({ length: EMBED_DIMS }, () => 0.5);
let tries = 0;
const waits = [];
const flaky = async (texts) => (++tries < 3 ? texts.map(() => null) : texts.map(() => v1));
const got = await embedWithRetry(flaky, ["أ", "ب"], { attempts: 3, baseDelayMs: 100, sleep: async (ms) => waits.push(ms) });
ok(tries === 3 && got.length === 2 && assertVectors(got, 2) && JSON.stringify(waits) === "[100,200]", "embedWithRetry: نجاح في الثالثة بتراجع 100 ثم 200");
tries = 0;
const dead = await embedWithRetry(async (texts) => (++tries, texts.map(() => null)), ["أ"], { attempts: 3, sleep: async () => {} });
ok(tries === 3 && dead[0] === null, "embedWithRetry: بعد استنفاد المحاولات يعيد الفشل ليوقفه assertVectors");
throws(() => assertVectors(dead, 1), /غير صالح/, "الفشل النهائي يوقف الكل");
tries = 0;
await embedWithRetry(async (texts) => (++tries, texts.map(() => v1)), ["أ"], { sleep: async () => { throw new Error("لا انتظار"); } });
ok(tries === 1, "embedWithRetry: الدفعة الناجحة لا تُعاد");

console.log(failed === 0 ? "✓ HKM-029 المتجهات (وحدة)" : `✗ فشل ${failed}`);
process.exit(failed === 0 ? 0 : 1);
