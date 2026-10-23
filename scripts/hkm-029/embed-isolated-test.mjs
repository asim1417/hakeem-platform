/**
 * HKM-029 — اختبار معزول لأداة المتجهات على قاعدة محلية فقط (127.0.0.1، hakeem_hkm029_embed_test، pgvector) ببيانات مصطنعة.
 * نموذج التضمين محاكى: دالة حتمية، ثم embedBatch الحقيقي على خادم HTTP محلي (EMBEDDING_BASE_URL).
 *   EMBED_TEST_URL=postgresql://postgres@127.0.0.1:54330/hakeem_hkm029_embed_test npx tsx scripts/hkm-029/embed-isolated-test.mjs
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Client } from "pg";
import { ISOLATED_EMBED_DATABASE, SUMMARY_SQL, workflowArgsToRun } from "./embed-lib.mjs";
import { connectionTarget } from "./drift-lib.mjs";

// لا Prisma حقيقي: الوحدات المستوردة تبني PrismaClient عند الاستيراد إن غاب هذا.
globalThis.prisma = {};

const URL_ = process.env.EMBED_TEST_URL ?? "";
const { host, database } = connectionTarget(URL_);
if (!URL_ || !["127.0.0.1", "localhost"].includes(host) || database !== ISOLATED_EMBED_DATABASE) {
  throw new Error(`EMBED_TEST_URL يجب أن يشير إلى 127.0.0.1 وقاعدة ${ISOLATED_EMBED_DATABASE}`);
}

let failed = 0;
let passed = 0;
const ok = (c, m) => {
  console.log(`${c ? "✓" : "✗"} ${m}`);
  if (c) passed++;
  else failed++;
};
async function rejects(fn, re, m) {
  try {
    await fn();
    ok(false, m);
  } catch (e) {
    ok(re.test(String(e.message)), `${m} (${String(e.message).slice(0, 60)})`);
  }
}

const vec = (t) => {
  const h = createHash("sha256").update(t).digest();
  return Array.from({ length: 1536 }, (_, i) => (h[i % 32] - 128) / 128);
};
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

async function setup(c) {
  await c.query(`DROP TABLE IF EXISTS embedding_version, embeddings, unit_version, legal_articles, legal_systems CASCADE`);
  await c.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  await c.query(`CREATE TABLE legal_systems (id text PRIMARY KEY, name text)`);
  await c.query(`CREATE TABLE legal_articles (id text PRIMARY KEY, "lawName" text, "articleNumber" int, "articleBis" int DEFAULT 0, title text, content text, "legalSystemId" text)`);
  await c.query(`CREATE TABLE unit_version (id text PRIMARY KEY, unit_id text NOT NULL, body text NOT NULL, valid_from timestamptz NOT NULL, evidence_instrument text, evidence_url text, created_at timestamptz NOT NULL DEFAULT now())`);
  await c.query(`CREATE TABLE embeddings (id text PRIMARY KEY, owner_type text, owner_id text, embedding vector(1536), content_hash text, UNIQUE (owner_type, owner_id))`);
  await c.query(`CREATE TABLE embedding_version (id text PRIMARY KEY, owner_type text NOT NULL, owner_id text NOT NULL, embedding vector(1536), model text NOT NULL, content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`);
  await c.query(`CREATE OR REPLACE FUNCTION hakeem_append_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME; END; $$`);
  await c.query(`CREATE TRIGGER embedding_version_append_only BEFORE UPDATE OR DELETE ON embedding_version FOR EACH ROW EXECUTE FUNCTION hakeem_append_only()`);
  await c.query(`INSERT INTO legal_systems VALUES ('s1', 'نظام تجريبي'), ('s2', 'نظام المحاكم التجارية')`);
  const arts = [
    ["a1", "نظام تجريبي", 1, 0, "المادة 1", "نص المادة الأولى سليم", "s1"],
    ["a2", "نظام تجريبي", 2, 0, "المادة 2", "نص المادة الثانية بعد التعديل", "s1"],
    ["a3", "نظام تجريبي", 3, 0, "المادة 3", "نص بالتطويل الثالثـــة", "s1"],
    ["a4", "نظام تجريبي", 4, 0, "المادة 4", "نص الرابعة له نسخة سليمة", "s1"],
    ["a5", "نظام تجريبي", 5, 0, "المادة 5", "نص الخامسة له نسخة قديمة", "s1"],
    ["a6", "نظام تجريبي", 6, 1, "المادة 6 مكرر", "نص السادسة مكرر قديم", "s1"],
    ["a7", "نظام تجريبي", 7, 0, "المادة 7", "نص السابعة قبل التعديل", "s1"], // نسخة سارية → النص الساري غير المضمَّن = قديم
    ["a8", "نظام تجريبي", 8, 0, "المادة 8", "نص الثامنة قبل تعديل لم يسرِ", "s1"], // نسخة مستقبلية → النص الأصلي = سليم
    ["a9", "نظام تجريبي", 9, 0, "المادة 9", "نص التاسعة الأصلي", "s1"], // نسختان ساريتان بلا متجه → مفقود، والأحدث هي المضمَّنة
    ["c18", "نظام المحاكم التجارية", 18, 0, "المادة 18", "المادة الثامنة عشرة\nللمحكمة أن تفصل", "s2"],
    ["c19", "نظام المحاكم التجارية", 19, 0, "المادة 19", "المادة التاسعة عشرة\nيجب في الدعاوى", "s2"],
    ["c26", "نظام المحاكم التجارية", 26, 0, "المادة 26", "المادة السادسة والعشرون\nللمحكمة عند تخلف", "s2"],
    ["c27", "نظام المحاكم التجارية", 27, 0, "المادة 27", "مادة بلا متجه خارج النطاق", "s2"],
    ["c93", "نظام المحاكم التجارية", 93, 100, "مرفق", "صف غير مادي قديم", "s2"],
  ];
  for (const a of arts) await c.query(`INSERT INTO legal_articles VALUES ($1,$2,$3,$4,$5,$6,$7)`, a);
  const ver = (id, unit, body, from) => c.query(`INSERT INTO unit_version (id, unit_id, body, valid_from, evidence_instrument) VALUES ($1, $2, $3, $4, 'مرسوم تجريبي')`, [id, unit, body, from]);
  await ver("u7", "a7", "نص السابعة بعد التعديل الساري", "2026-01-01");
  await ver("u8", "a8", "نص الثامنة بعد تعديل مستقبلي", "2099-01-01");
  await ver("u9a", "a9", "نص التاسعة نسخة أولى", "2025-01-01");
  await ver("u9b", "a9", "نص التاسعة النسخة السارية الأحدث", "2026-01-01");
  await ver("u9c", "a9", "نص التاسعة نسخة لم تسرِ", "2099-01-01");
  const text = (sys, title, content) => [sys, title, content].filter(Boolean).join("\n");
  const emb = async (id, owner, hash) =>
    c.query(`INSERT INTO embeddings VALUES ($1, 'article', $2, $3::vector, $4)`, [id, owner, `[${vec(owner).join(",")}]`, hash]);
  await emb("e1", "a1", sha(text("نظام تجريبي", "المادة 1", "نص المادة الأولى سليم")));
  await emb("e2", "a2", sha("نص قديم"));
  await emb("e3", "a3", sha(text("نظام تجريبي", "المادة 3", "نص بالتطويل الثالثـــة"))); // قبل حذف التطويل = سليم
  await emb("e4", "a4", sha("قديم"));
  await emb("e5", "a5", sha(text("نظام تجريبي", "المادة 5", "نص الخامسة له نسخة قديمة")));
  await emb("e6", "a6", sha("قديم"));
  await emb("e7", "a7", sha(text("نظام تجريبي", "المادة 7", "نص السابعة قبل التعديل"))); // بصمة النص الأصلي لا الساري = قديم
  await emb("e8", "a8", sha(text("نظام تجريبي", "المادة 8", "نص الثامنة قبل تعديل لم يسرِ"))); // النسخة لم تسرِ = سليم
  await emb("e18", "c18", sha("قديم"));
  await emb("e93", "c93", sha("قديم"));
  const fp4 = sha(`${text("نظام تجريبي", "المادة 4", "نص الرابعة له نسخة سليمة")}\ntext-embedding-3-small`);
  await c.query(`INSERT INTO embedding_version (id, owner_type, owner_id, embedding, model, content_hash) VALUES ('v4', 'article', 'a4', $1::vector, 'text-embedding-3-small', $2)`, [`[${vec("a4").join(",")}]`, fp4]);
  await c.query(`INSERT INTO embedding_version (id, owner_type, owner_id, embedding, model, content_hash) VALUES ('v5', 'article', 'a5', $1::vector, 'text-embedding-3-small', 'قديم')`, [`[${vec("a5").join(",")}]`]);
}

async function freeze(c) {
  const s = (await c.query(SUMMARY_SQL)).rows[0];
  return { task: "HKM-029", kind: "embeddings", model: "text-embedding-3-small", selected: s.selected, stale: s.stale, missing: s.missing, ids_md5: s.ids_md5, state_md5: s.state_md5 };
}
const versions = async (c) => (await c.query(`SELECT count(*)::int AS n FROM embedding_version`)).rows[0].n;

async function main() {
  const { runEmbed, realDeps } = await import("./embed-articles.mjs");
  const real = await realDeps();
  const c = new Client({ connectionString: URL_ });
  await c.connect();
  try {
    // (أ) نسخة قديمة بالبصمة الصحيحة تحت نسخة أحدث قديمة: الاختيار يضم المادة وتُكتب فوقها إضافةً (الأحدث هي المعتبرة).
    // (ب) مادة بهاتف: بصمة الكود (بعد الحجب) ≠ بصمة SQL، وأحدث نسختها تحمل بصمة الكود → «قديمة» عند SQL، مضمَّنة فعلًا عند الكود → تُتخطّى.
    await setup(c);
    const fp5 = sha("نظام تجريبي\nالمادة 5\nنص الخامسة له نسخة قديمة\ntext-embedding-3-small");
    await c.query(`INSERT INTO embedding_version (id, owner_type, owner_id, embedding, model, content_hash, created_at) VALUES ('v5old', 'article', 'a5', $1::vector, 'text-embedding-3-small', $2, now() - interval '1 day')`, [`[${vec("a5").join(",")}]`, fp5]);
    const phoneContent = "للتواصل على الرقم 0501234567 بشأن الطلب";
    await c.query(`INSERT INTO legal_articles VALUES ('a10', 'نظام تجريبي', 10, 0, 'المادة 10', $1, 's1')`, [phoneContent]);
    const fp10 = real.fingerprint(real.buildText({ systemName: "نظام تجريبي", title: "المادة 10", content: phoneContent }));
    ok(fp10 !== sha(`نظام تجريبي\nالمادة 10\n${phoneContent}\ntext-embedding-3-small`), "بصمة الكود بعد حجب الهاتف تختلف عن بصمة SQL");
    await c.query(`INSERT INTO embedding_version (id, owner_type, owner_id, embedding, model, content_hash) VALUES ('v10', 'article', 'a10', $1::vector, 'text-embedding-3-small', $2)`, [`[${vec("a10").join(",")}]`, fp10]);
    const m0 = await freeze(c);
    ok(m0.selected === 10 && m0.stale === 6, `الاختيار يعدّ a5 وa10 قديمتين (${m0.selected}/${m0.stale})`);
    const res0 = await runEmbed(c, m0, { ...real, embed: async (texts) => texts.map(vec) }, { apply: true, approvedRows: m0.selected, url: URL_ });
    ok(res0.already_current === 1 && res0.written === 9 && (await versions(c)) === 4 + 9, "المضمَّنة فعلًا ببصمة الكود تُتخطّى، والباقي يُكتب (النسخة القديمة تحت الأحدث لا تمنع)");
    const l5 = (await c.query(`SELECT content_hash FROM embedding_version WHERE owner_id = 'a5' ORDER BY created_at DESC LIMIT 1`)).rows[0].content_hash;
    ok(l5 === fp5 && (await c.query(`SELECT count(*)::int AS n FROM embedding_version WHERE owner_id = 'a10'`)).rows[0].n === 1, "a5: أحدث نسخة بالبصمة الصحيحة؛ a10: بلا صف جديد");
    await rejects(() => runEmbed(c, m0, { ...real, embed: async (texts) => texts.map(vec) }, { apply: true, approvedRows: m0.selected, url: URL_ }), /تغيّر منذ التجميد/, "التشغيل الثاني بالقائمة نفسها مرفوض");

    await setup(c);
    const m = await freeze(c);
    ok(m.selected === 9 && m.stale === 5 && m.missing === 4, `الاختيار: القديمة a2 وa5 (نسخة قديمة) وa6 (مكرر) وa7 (نسخة سارية) و18، والمفقودة a9 و19 و26 و27 (${m.selected}/${m.stale}/${m.missing})`);
    const ids = (await c.query(`${SUMMARY_SQL.replace(/SELECT \(SELECT count[\s\S]*$/, "")} SELECT string_agg(id, ',' ORDER BY id) AS ids FROM sel`)).rows[0].ids;
    ok(ids === "a2,a5,a6,a7,a9,c18,c19,c26,c27", `المعرّفات المختارة (${ids}): لا a1 السليم، ولا a3 قبل حذف التطويل، ولا a4 بنسخته السليمة، ولا a8 (نسخته لم تسرِ)، ولا الصف غير المادي`);
    const bodies = (await c.query(`${SUMMARY_SQL.replace(/SELECT \(SELECT count[\s\S]*$/, "")} SELECT id, body FROM sel WHERE id IN ('a7', 'a9', 'a2') ORDER BY id`)).rows;
    ok(JSON.stringify(bodies.map((r) => r.body)) === JSON.stringify(["نص المادة الثانية بعد التعديل", "نص السابعة بعد التعديل الساري", "نص التاسعة النسخة السارية الأحدث"]), "النص المضمَّن = أحدث نسخة سارية (valid_from <= now())، وإلا content");

    let calls = 0;
    const deps = { ...real, embed: async (texts) => { calls += texts.length; return texts.map(vec); } };
    const dry = await runEmbed(c, m, deps, { apply: false, approvedRows: null, url: URL_ });
    ok(dry.mode === "dry-run" && dry.written === 0 && calls === 1 && (await versions(c)) === 2, "التجريب: نداء اختبار واحد ولا كتابة");
    ok(dry.sql_hash_mismatch === 0, "بصمة SQL المكافئة = بصمة الكود (buildEmbeddingText وembeddingFingerprint) لكل الصفوف");

    await rejects(() => runEmbed(c, { ...m, selected: m.selected + 1, stale: m.stale + 1 }, deps, { apply: true, approvedRows: 10, url: URL_ }), /تغيّر منذ التجميد/, "قائمة لا تطابق الاختيار الحي توقف الكل");
    await c.query(`UPDATE legal_articles SET content = content || ' تعديل' WHERE id = 'a2'`);
    await rejects(() => runEmbed(c, m, deps, { apply: true, approvedRows: 9, url: URL_ }), /state_md5/, "تغيّر متن بعد التجميد يوقف الكل");
    await c.query(`UPDATE legal_articles SET content = 'نص المادة الثانية بعد التعديل' WHERE id = 'a2'`);

    // تغيّر متن أثناء التوليد (بين القراءة والكتابة) → إلغاء المعاملة.
    const racing = { ...real, embed: async (texts) => { if (texts.length > 1) await c.query(`UPDATE legal_articles SET title = 'المادة 2 معدلة' WHERE id = 'a2'`); return texts.map(vec); } };
    await rejects(() => runEmbed(c, m, racing, { apply: true, approvedRows: 9, url: URL_ }), /تغيّر بين القراءة والكتابة/, "تغيّر متن أثناء التوليد يلغي الكتابة");
    ok((await versions(c)) === 2, "لا صف جديد بعد الإلغاء");
    await c.query(`UPDATE legal_articles SET title = 'المادة 2' WHERE id = 'a2'`);

    const failing = { ...real, embed: async (texts) => texts.map((t, i) => (i === texts.length - 1 && texts.length > 1 ? null : vec(t))) };
    await rejects(() => runEmbed(c, m, failing, { apply: true, approvedRows: 9, url: URL_ }), /متجه غير صالح/, "فشل متجه واحد = لا كتابة");
    const short = { ...real, embed: async (texts) => texts.map((t) => vec(t).slice(1)) };
    await rejects(() => runEmbed(c, m, short, { apply: false, approvedRows: null, url: URL_ }), /متجه غير صالح/, "التجريب يكشف طولًا غير 1536");
    ok((await versions(c)) === 2, "لا صف جديد بعد فشل النموذج");

    const res = await runEmbed(c, m, deps, { apply: true, approvedRows: 9, url: URL_ });
    ok(res.mode === "apply" && res.written === 9 && (await versions(c)) === 11, "الكتابة: 9 نسخ جديدة، والنسختان القديمتان باقيتان (إضافة فقط)");
    const after = (await c.query(SUMMARY_SQL)).rows[0];
    ok(after.selected === 0, "بعد الكتابة: لا قديم ولا مفقود في النطاق");
    const fpOf = (title, body) => real.fingerprint(real.buildText({ systemName: "نظام تجريبي", title, content: body }));
    const written = (await c.query(`SELECT DISTINCT ON (owner_id) owner_id, content_hash FROM embedding_version WHERE owner_id IN ('a7', 'a9') ORDER BY owner_id, created_at DESC`)).rows;
    ok(written.length === 2 && written[0].content_hash === fpOf("المادة 7", "نص السابعة بعد التعديل الساري") && written[1].content_hash === fpOf("المادة 9", "نص التاسعة النسخة السارية الأحدث"), "البصمة المكتوبة = بصمة النص الساري (النسخة لا content)");
    const latest = (await c.query(`SELECT DISTINCT ON (owner_id) owner_id, model, vector_dims(embedding) AS d FROM embedding_version ORDER BY owner_id, created_at DESC`)).rows;
    ok(latest.every((r) => r.model === "text-embedding-3-small" && r.d === 1536), "أحدث نسخة لكل مادة بالنموذج والطول الصحيحين");
    ok((await c.query(`SELECT count(*)::int AS n FROM embeddings`)).rows[0].n === 10, "جدول embeddings لم يُمس");
    await rejects(() => runEmbed(c, m, deps, { apply: true, approvedRows: 9, url: URL_ }), /تغيّر منذ التجميد/, "التشغيل الثاني مرفوض");
    await rejects(() => c.query(`UPDATE embedding_version SET model = 'x'`), /append-only/, "مشغّل الإضافة فقط يمنع التعديل");

    // embedBatch الحقيقي على خادم محلي محاكى (الطلب والنموذج والترتيب).
    let seenModel = "";
    let seenInputs = 0;
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const j = JSON.parse(body);
        seenModel = j.model;
        seenInputs += j.input.length;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ data: j.input.map((t, index) => ({ index, embedding: vec(t) })) }));
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", () => r()));
    const port = server.address().port;
    process.env.EMBEDDING_BASE_URL = `http://127.0.0.1:${port}/v1`;
    process.env.EMBEDDING_API_KEY = "test-key-not-real";
    const out = await real.embed(["نص أول", "نص ثانٍ"]);
    ok(seenModel === "text-embedding-3-small" && seenInputs === 2 && out.length === 2 && out.every((v) => v?.length === 1536), "embedBatch الحقيقي: النموذج والدفعة والطول");
    ok(JSON.stringify(out[1]) === JSON.stringify(vec("نص ثانٍ")), "embedBatch الحقيقي: الترتيب محفوظ");
    server.close();

    // وسائط المسار القائم.
    ok(workflowArgsToRun(["--target", "articles", "--all", "--limit", "6"])?.approvedRows === 6, "وسائط backfill-embeddings.yml تُحوَّل إلى العدد المعتمد");
  } finally {
    await c.end();
  }
  console.log(failed === 0 ? `✓ HKM-029 المتجهات (معزول) ${passed}/${passed}` : `✗ فشل ${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
