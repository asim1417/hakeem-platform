/**
 * HKM-029 — اختبار معزول على قاعدة محلية فقط (127.0.0.1، القاعدة hakeem_hkm029) ببيانات مصطنعة.
 * لا يقرأ الإنتاج ولا يكتب عليه.
 *   HKM029_LOCAL_URL=postgresql://user:pass@127.0.0.1:5432/hakeem_hkm029 npx tsx scripts/hkm-029/isolated-test.mjs
 */
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";
import { auditOpenSearch, auditSnapshot, loadSnapshot } from "./audit-index-drift.mjs";
import { ISOLATED_DATABASE, buildManifest, classifyObservation, connectionTarget, embeddingTextHashes, embeddingTexts, hostOf, sha256 } from "./drift-lib.mjs";
import { loadLedger, rebuildSearchNorm, verifyLedger } from "./rebuild-search-norm.mjs";
import { rollbackSearchNorm } from "./rollback-search-norm.mjs";

const LOCAL = process.env.HKM029_LOCAL_URL ?? "";
const host = hostOf(LOCAL);
if (!LOCAL || (host !== "127.0.0.1" && host !== "localhost")) throw new Error("HKM029_LOCAL_URL يجب أن يشير إلى 127.0.0.1 أو localhost");
const dbName = connectionTarget(LOCAL).database;
if (dbName !== ISOLATED_DATABASE) throw new Error(`مرفوض: القاعدة ${dbName} ليست ${ISOLATED_DATABASE}`);
const HOST = host;

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
    ok(re.test(String(e?.message)), `${m} (${String(e?.message).slice(0, 60)})`);
  }
}

const LAW = "نظام الاختبار المعزول";
// نصوص مصطنعة بكلمات خاصة بكل مادة.
const TEXTS = {
  1: "يسري هذا النظام على العقود البحرية والنهرية",
  2: "تختص اللجنة بالنظر في منازعات الموانئ ـ والمرافئ",
  3: "يلتزم الناقل بتسليم البضاعة سليمة في الميعاد",
  4: "يجوز للمقاول فسخ عقد المقاولة إذا توقف رب العمل عن الدفع",
  5: "للموكل عزل الوكيل في أي وقت قبل إتمام العمل",
  6: "لا تسمع الدعوى بمضي عشر سنوات من تاريخ الاستحقاق",
  7: "إذا زادت مساحة العقار المبيع عن المذكور في العقد",
  8: "تنشر اللائحة في الجريدة الرسمية ويعمل بها من تاريخ نشرها",
};
const row = (n) => ({ id: `t${n}`, lawName: LAW, articleNumber: n, title: `المادة ${n}`, content: TEXTS[n], keywords: [], classification: "تجريبي", chapter: null });
const expected = (n) => buildSearchNorm(row(n));
// المخزَّن عند الزرع: 3 و4 و5 منزاحة (تحمل فهرس التالية)، 7 مسافات فقط، 8 نص تغيّر، 2 فارغ.
const STORED = {
  1: expected(1),
  2: null,
  3: expected(4),
  4: expected(5),
  5: expected(6),
  6: expected(6),
  7: expected(7).replace(" ", "  ") + " ",
  8: buildSearchNorm({ ...row(8), content: "نص قديم للائحة قبل تعديلها" }),
};

async function seed(c) {
  const live = await c.query("SELECT current_database() AS name");
  if (live.rows[0].name !== ISOLATED_DATABASE) throw new Error("مرفوض: ليست قاعدة الاختبار");
  await c.query(`DROP TABLE IF EXISTS embedding_version, embeddings, legal_articles, legal_systems`);
  await c.query(`CREATE TABLE legal_systems (id text PRIMARY KEY, name text NOT NULL)`);
  await c.query(`CREATE TABLE legal_articles (
    id text PRIMARY KEY, "legalSystemId" text, "lawName" text NOT NULL, "articleNumber" int NOT NULL, "articleBis" int NOT NULL DEFAULT 0,
    title text NOT NULL, content text NOT NULL, keywords text[] DEFAULT '{}', classification text, chapter text, search_norm text)`);
  await c.query(`CREATE TABLE embeddings (id text PRIMARY KEY, owner_type text NOT NULL, owner_id text NOT NULL, content_hash text)`);
  await c.query(`INSERT INTO legal_systems VALUES ('s1', $1)`, [LAW]);
  for (let n = 1; n <= 8; n++) {
    const r = row(n);
    await c.query(
      `INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", title, content, keywords, classification, chapter, search_norm) VALUES ($1,'s1',$2,$3,$4,$5,$6,$7,$8,$9)`,
      [r.id, r.lawName, r.articleNumber, r.title, r.content, r.keywords, r.classification, r.chapter, STORED[n]],
    );
  }
  // المتجهات: 1 سليم، 2 سليم قبل الحجب (فيه تطويل)، 3 قديم، والبقية بلا متجه.
  const parts = (n) => ({ systemName: LAW, title: row(n).title, content: row(n).content });
  await c.query(`INSERT INTO embeddings VALUES ('e1','article','t1',$1), ('e2','article','t2',$2), ('e3','article','t3',$3)`, [
    embeddingTextHashes(parts(1)).current,
    sha256([LAW, row(2).title, row(2).content].join("\n")),
    sha256("نص قديم"),
  ]);
}

const state = async (c) => (await c.query(`SELECT id, search_norm, md5(content) AS mc FROM legal_articles ORDER BY id`)).rows;
const hits = async (c, word) => (await c.query(`SELECT "articleNumber" AS n FROM legal_articles WHERE search_norm LIKE '%' || $1 || '%' ORDER BY 1`, [word])).rows.map((r) => r.n);

async function main() {
  const admin = new Client({ connectionString: LOCAL.replace(/\/[^/?]+(\?|$)/, "/postgres$1") });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [ISOLATED_DATABASE]);
  if (!exists.rowCount) await admin.query(`CREATE DATABASE ${ISOLATED_DATABASE}`);
  await admin.end();

  const tmp = mkdtempSync(path.join(tmpdir(), "hkm029-"));
  const ledgerFile = path.join(tmp, "isolated.json");
  const c = new Client({ connectionString: LOCAL });
  await c.connect();
  try {
    // ── أ. الجرد ──
    await seed(c);
    const snap = await loadSnapshot(c);
    ok(snap.readOnly && snap.isolation === "repeatable read" && snap.database === ISOLATED_DATABASE, "الجرد يقرأ في معاملة REPEATABLE READ وREAD ONLY على القاعدة المعزولة");
    const audit = auditSnapshot(snap);
    const cat = audit.searchNorm.byCategory;
    ok(cat.shifted === 3 && cat.whitespace_only === 1 && cat.content_changed === 1 && cat.empty === 1, `التصنيف: منزاح 3، مسافات 1، نص 1، فارغ 1 (${JSON.stringify(cat)})`);
    ok(audit.drift.find((d) => d.id === "t4")?.matchesArticle?.number === 5, "المادة 4 تحمل فهرس المادة 5 (shifted برقمها)");
    ok(audit.vectors.fresh === 1 && audit.vectors.fresh_legacy === 1 && audit.vectors.stale === 1 && audit.vectors.missing === 5, `المتجهات: سليم 1، قبل الحجب 1، قديم 1، مفقود 5 (${JSON.stringify({ f: audit.vectors.fresh, l: audit.vectors.fresh_legacy, s: audit.vectors.stale, m: audit.vectors.missing })})`);
    ok(!JSON.stringify(audit.drift).includes("المقاول"), "مخرجات الجرد بلا نصوص");
    // OpenSearch بقراءة _mget فقط (fetch محاكى): 1 سليم، 3 قديم الرقم، 4 مفقود.
    const calls = [];
    const fakeFetch = async (url, init) => {
      calls.push({ url, method: init.method, body: JSON.parse(init.body) });
      const docs = JSON.parse(init.body).ids.map((id) => {
        const n = Number(id.replace("article:t", ""));
        if (n === 4) return { _id: id, found: false };
        return { _id: id, found: true, _source: { title: row(n).title, content: row(n).content, articleNumber: n === 3 ? 99 : n, lawName: n === 5 ? "نظام آخر" : LAW } };
      });
      return { ok: true, json: async () => ({ docs }) };
    };
    const os = await auditOpenSearch(audit.rows, ["t1", "t3", "t4", "t5"], { OPENSEARCH_URL: "http://127.0.0.1:9", OPENSEARCH_USERNAME: "u", OPENSEARCH_PASSWORD: "p" }, fakeFetch);
    ok(os.status === "ok" && os.fresh === 1 && os.stale === 2 && os.missing === 1, `OpenSearch: سليم 1، قديم 2 (رقم واسم نظام)، مفقود 1 (${JSON.stringify({ f: os.fresh, s: os.stale, m: os.missing })})`);
    ok(calls.length === 1 && calls[0].method === "POST" && calls[0].url.endsWith("/legal_articles/_mget?_source=title,content,articleNumber,lawName"), "OpenSearch يُقرأ بـ _mget فقط (لا كتابة)");
    ok((await auditOpenSearch(audit.rows, ["t1"], {}, fakeFetch)).status === "not_run", "بلا OPENSEARCH_URL: not_run");
    const manifest = buildManifest({ drift: audit.drift, rows: audit.rows, source: "isolated", frozenAt: new Date().toISOString() });
    ok(manifest.expected_count === 4, "القائمة المجمّدة 4 (3 منزاحة + 1 نص تغيّر)");

    // ── ب. قبل الإعادة وبعدها ──
    const before = await state(c);
    ok(JSON.stringify(await hits(c, "المقاوله")) === "[3]", "قبل الإعادة: كلمات نص 4 تعيد 3 ولا تعيد 4");
    ok(JSON.stringify(await hits(c, "الوكيل")) === "[4]", "قبل الإعادة: كلمات نص 5 تعيد 4 ولا تعيد 5");
    ok(JSON.stringify(await hits(c, "تسمع")) === "[5,6]", "قبل الإعادة: كلمات نص 6 تعيد 5 و6");
    const res = await rebuildSearchNorm(c, manifest, { target: "isolated", host: HOST, ledgerFile });
    ok(res.status === "committed" && res.updated === 4, "الإعادة: 4 صفوف في معاملة واحدة");
    ok(JSON.stringify(await hits(c, "المقاوله")) === "[4]", "بعد الإعادة: كلمات نص 4 تعيد 4 ولا تعيد 3");
    ok(JSON.stringify(await hits(c, "الوكيل")) === "[5]", "بعد الإعادة: كلمات نص 5 تعيد 5");
    ok(JSON.stringify(await hits(c, "تسمع")) === "[6]", "بعد الإعادة: كلمات نص 6 تعيد 6 وحدها (كانت 5 و6)");
    const after = await state(c);
    ok(after.every((r, i) => r.mc === before[i].mc), "md5(content) ثابت لكل الصفوف");
    ok(after.find((r) => r.id === "t7").search_norm === STORED[7] && after.find((r) => r.id === "t2").search_norm === null, "خارج النطاق لم يُمسّ (مسافات فقط والفارغ)");
    const ledger = loadLedger(ledgerFile);
    ok(ledger.rows.length === 4 && ledger.rows.every((r) => typeof r.old_search_norm === "string" && r.new_search_norm), "السجل يحفظ القديم والجديد لكل صف");
    const v1 = await verifyLedger(LOCAL, ledgerFile);
    ok(v1.outcome === "confirmed" && v1.read_only, "التحقق باتصال جديد للقراءة: confirmed");
    const reaudit = auditSnapshot(await loadSnapshot(c));
    ok(reaudit.searchNorm.byCategory.shifted === 0 && reaudit.searchNorm.byCategory.content_changed === 0, "إعادة الجرد: لا منزاح ولا نص تغيّر");

    // ── ربط السجل بالمضيف: التحقق والتراجع يرفضان اتصالًا بمضيف آخر ولو كانت القاعدة باسمها ──
    const otherHost = LOCAL.replace(`@${HOST}:`, HOST === "127.0.0.1" ? "@localhost:" : "@127.0.0.1:");
    await rejects(() => verifyLedger(otherHost, ledgerFile), /مضيف التحقق/, "التحقق يرفض مضيفًا غير مضيف السجل");
    await rejects(() => rollbackSearchNorm(c, ledgerFile, { host: "localhost.invalid" }), /مضيف التراجع/, "التراجع يرفض مضيفًا غير مضيف السجل");

    // ── ج. التشغيل الثاني مرفوض ──
    await rejects(() => rebuildSearchNorm(c, manifest, { target: "isolated", host: HOST, ledgerFile }), /سجل دفعة سابق/, "التشغيل الثاني مرفوض بوجود السجل");
    renameSync(ledgerFile, `${ledgerFile}.moved`);
    await rejects(() => rebuildSearchNorm(c, manifest, { target: "isolated", host: HOST, ledgerFile }), /الفهرس المخزَّن تغيّر/, "ولو نُقل السجل: حارس md5(search_norm) المجمّد يرفض");
    ok(!existsSync(ledgerFile), "الرفض لا يكتب سجلًا");
    renameSync(`${ledgerFile}.moved`, ledgerFile);

    // ── د. التراجع ──
    const rb = await rollbackSearchNorm(c, ledgerFile, { host: HOST });
    ok(rb.status === "rolled_back" && rb.restored === 4, "التراجع: 4 صفوف");
    const restored = await state(c);
    ok(restored.every((r, i) => r.search_norm === before[i].search_norm && r.mc === before[i].mc), "التراجع يعيد القديم حرفيًّا لكل الصفوف");
    ok(classifyObservation(loadLedger(ledgerFile), restored.map((r) => ({ ...r, present: true }))).outcome === "not_applied" && loadLedger(ledgerFile).commit_status === "rolled_back", "بعد التراجع: السجل rolled_back والمشاهد = القديم");
    await rejects(() => rollbackSearchNorm(c, ledgerFile, { host: HOST }), /متراجع عنها/, "التراجع الثاني مرفوض");
    rmSync(ledgerFile);

    // ── هـ. تغيّر متن قبل الكتابة يلغي الدفعة كلها ──
    await seed(c);
    const m2 = buildManifest({ drift: auditSnapshot(await loadSnapshot(c)).drift, rows: auditSnapshot(await loadSnapshot(c)).rows, source: "isolated", frozenAt: "t" });
    await c.query(`UPDATE legal_articles SET content = content || ' (تعديل)' WHERE id = 't5'`);
    const s2 = await state(c);
    await rejects(() => rebuildSearchNorm(c, m2, { target: "isolated", host: HOST, ledgerFile }), /نص مادة مستهدفة تغيّر/, "تغيير متن صف قبل الكتابة يلغي الدفعة");
    ok(JSON.stringify(await state(c)) === JSON.stringify(s2) && !existsSync(ledgerFile), "لا كتابة جزئية ولا سجل");

    // ── و. معرّف محذوف يوقف الكل ──
    await seed(c);
    const m3 = buildManifest({ drift: auditSnapshot(await loadSnapshot(c)).drift, rows: auditSnapshot(await loadSnapshot(c)).rows, source: "isolated", frozenAt: "t" });
    await c.query(`DELETE FROM legal_articles WHERE id = 't3'`);
    const s3 = await state(c);
    await rejects(() => rebuildSearchNorm(c, m3, { target: "isolated", host: HOST, ledgerFile }), /العدد/, "معرّف غائب من القاعدة يوقف الكل");
    ok(JSON.stringify(await state(c)) === JSON.stringify(s3), "لا كتابة بعد الإيقاف");
    await rejects(() => rebuildSearchNorm(c, { ...m3, rows: m3.rows.slice(1) }, { target: "isolated", host: HOST, ledgerFile }), /العدد/, "حذف معرّف من القائمة يوقف الكل");

    // ── ز. التراجع يرفض صفًّا تغيّر بعد الكتابة ──
    await seed(c);
    const m4 = buildManifest({ drift: auditSnapshot(await loadSnapshot(c)).drift, rows: auditSnapshot(await loadSnapshot(c)).rows, source: "isolated", frozenAt: "t" });
    await rebuildSearchNorm(c, m4, { target: "isolated", host: HOST, ledgerFile });
    await c.query(`UPDATE legal_articles SET search_norm = search_norm || ' تعديل لاحق' WHERE id = 't4'`);
    const s4 = await state(c);
    await rejects(() => rollbackSearchNorm(c, ledgerFile, { host: HOST }), /تغيّر بعد الدفعة/, "التراجع يرفض صفًّا تغيّرت قيمته بعد الكتابة");
    ok(JSON.stringify(await state(c)) === JSON.stringify(s4), "ولا يتراجع جزئيًّا");
    const v2 = await verifyLedger(LOCAL, ledgerFile);
    ok(v2.outcome === "unconfirmed", "التحقق بعد تعديل لاحق: unconfirmed (يمنع المتابعة)");
    rmSync(ledgerFile);

    // ── ط. السجل محفوظ على القرص بحالة غير مؤكدة قبل إرسال COMMIT ──
    await seed(c);
    const m5 = buildManifest({ drift: auditSnapshot(await loadSnapshot(c)).drift, rows: auditSnapshot(await loadSnapshot(c)).rows, source: "isolated", frozenAt: "t" });
    let seenAtCommit = null;
    await rebuildSearchNorm(c, m5, {
      target: "isolated",
      host: HOST,
      ledgerFile,
      commit: async (client) => {
        seenAtCommit = existsSync(ledgerFile) ? JSON.parse(readFileSync(ledgerFile, "utf8")) : null;
        await client.query("COMMIT");
      },
    });
    ok(seenAtCommit?.commit_status === "unconfirmed" && seenAtCommit.rows.length === 4 && seenAtCommit.host === HOST, "السجل على القرص (غير مؤكد، 4 صفوف، بمضيفه) قبل COMMIT");
    rmSync(ledgerFile);
    // فشل التثبيت بعد حفظ السجل: يبقى السجل، والتحقق يحسم not_applied.
    await seed(c);
    const m6 = buildManifest({ drift: auditSnapshot(await loadSnapshot(c)).drift, rows: auditSnapshot(await loadSnapshot(c)).rows, source: "isolated", frozenAt: "t" });
    await rejects(
      () => rebuildSearchNorm(c, m6, { target: "isolated", host: HOST, ledgerFile, commit: async (client) => { await client.query("ROLLBACK"); throw new Error("انقطاع"); } }),
      /غير مؤكدة/,
      "فشل التثبيت يُبلغ «غير مؤكدة» ولا يحذف السجل",
    );
    ok(existsSync(ledgerFile), "السجل باقٍ بعد فشل التثبيت");
    ok((await verifyLedger(LOCAL, ledgerFile)).outcome === "not_applied", "التحقق بعد فشل التثبيت: not_applied");
    rmSync(ledgerFile);

    // ── ي. شرط البصمة المجمّدة في جملة UPDATE نفسها ──
    await seed(c);
    const m7 = buildManifest({ drift: auditSnapshot(await loadSnapshot(c)).drift, rows: auditSnapshot(await loadSnapshot(c)).rows, source: "isolated", frozenAt: "t" });
    const s7 = await state(c);
    await rejects(
      () => rebuildSearchNorm(c, m7, {
        target: "isolated",
        host: HOST,
        ledgerFile,
        hooks: { beforeUpdate: async (client, r) => { if (r.id === "t4") await client.query(`UPDATE legal_articles SET search_norm = search_norm || ' x' WHERE id = 't4'`); } },
      }),
      /شرط البصمة المجمّدة/,
      "تغيّر الفهرس بين القفل والكتابة يُسقط شرط UPDATE فتُلغى الدفعة",
    );
    ok(JSON.stringify(await state(c)) === JSON.stringify(s7) && !existsSync(ledgerFile), "لا كتابة جزئية ولا سجل بعد سقوط الشرط");

    // ── ك. embedding_version مقدَّم على embeddings ──
    await seed(c);
    await c.query(`CREATE TABLE embedding_version (id text PRIMARY KEY, owner_type text, owner_id text, model text, content_hash text, created_at timestamptz DEFAULT now())`);
    const t3text = embeddingTexts({ systemName: LAW, title: row(3).title, content: row(3).content }).current;
    await c.query(`INSERT INTO embedding_version (id, owner_type, owner_id, model, content_hash, created_at) VALUES ('v0','article','t3','m1','قديم', now() - interval '1 day'), ('v1','article','t3','m1',$1, now())`, [sha256(`${t3text}\nm1`)]);
    const av = auditSnapshot(await loadSnapshot(c));
    ok(av.vectors.fresh === 2 && av.vectors.stale === 0 && av.vectors.source.version === 1, `أحدث نسخة في embedding_version تُقدَّم (سليم 2، قديم 0) (${JSON.stringify({ f: av.vectors.fresh, s: av.vectors.stale, src: av.vectors.source })})`);
    const osErr = await auditOpenSearch(av.rows, ["t1"], { OPENSEARCH_URL: "http://admin:S3cretPass@127.0.0.1:1" }, async () => { throw Object.assign(new Error("connect ECONNREFUSED http://admin:S3cretPass@127.0.0.1:1"), { cause: { code: "ECONNREFUSED" } }); });
    ok(osErr.status === "error" && !JSON.stringify(osErr).includes("S3cretPass"), "خطأ اتصال OpenSearch لا يطبع كلمة المرور");

    // ── ح. هدف الإنتاج على القاعدة المعزولة مرفوض ──
    await seed(c);
    await rejects(() => rebuildSearchNorm(c, m4, { target: "production", host: HOST, ledgerFile: path.join(tmp, "production.json") }), /لا يطابق القاعدة/, "هدف الإنتاج مرفوض على قاعدة الاختبار");
    await rejects(() => rebuildSearchNorm(c, { ...m4, expected_count: 0, rows: [] }, { target: "isolated", host: HOST, ledgerFile }), /فارغة/, "القائمة الفارغة مرفوضة (لا شيء يُكتب)");
  } finally {
    await c.end();
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failed === 0 ? `✓ HKM-029 المعزول ${passed}/${passed}` : `✗ فشل ${failed} من ${passed + failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "فشل");
  process.exit(2);
});
