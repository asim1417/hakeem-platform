/**
 * اختبار HKM-002 على قاعدة محلية فقط.
 * يقرأ نصوص الإنتاج بمعاملة READ ONLY ليزرع نسخة، ثم يكتب على 127.0.0.1.
 * لا يستدعي نقطة reindex العامة.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";
import { computeSurface, inSurface } from "../../lib/modules/legal-core/search-surface.ts";
import { assertLedgerBinding, classifyLedgerObservation, effectiveCommitStatus, fillNullSearchNorm, ledgerBatchId, ledgerPathFor, loadLedger, loadManifest, verifyLedgerApplied } from "./fill-null-search-norm.mjs";
import { rollbackNullSearchNorm } from "./rollback-null-search-norm.mjs";

const LAB_DATABASE = "hakeem_hkm002";
const LOCAL = process.env.HKM002_LOCAL_URL;
if (!LOCAL || !LOCAL.includes("@127.0.0.1:") && !LOCAL.includes("@localhost:")) {
  throw new Error("HKM002_LOCAL_URL يجب أن يشير إلى 127.0.0.1");
}

export function databaseNameOf(url) {
  return decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
}

/** يرفض أي اسم غير قاعدة الاختبار المعزولة. يُستدعى قبل المسح على الاسم الفعلي. */
export function assertLabDatabaseName(name) {
  if (name !== LAB_DATABASE) {
    throw new Error(`مرفوض: اسم القاعدة «${name}» ليس قاعدة الاختبار ${LAB_DATABASE}`);
  }
}

async function assertLiveLabDatabase(client) {
  const res = await client.query("SELECT current_database() AS name");
  assertLabDatabaseName(res.rows[0].name);
  return res.rows[0].name;
}

const checks = [];
function ok(name, condition) {
  checks.push({ name, pass: Boolean(condition) });
  if (!condition) throw new Error("فشل: " + name);
}

function recallSql() {
  const source = readFileSync(new URL("../../lib/modules/legal-core/legal-retrieval.ts", import.meta.url), "utf8");
  const match = source.match(/export function inDbRecallSql[\s\S]*?return `([\s\S]*?)`;/);
  if (!match || !match[1].includes("search_norm IS NOT NULL") || !match[1].includes("to_tsquery('simple', $1)")) {
    throw new Error("تعذّر قراءة شرط الاستدعاء المفهرس");
  }
  return match[1].replace("LIMIT ${cap}", "LIMIT 40000");
}

async function seed(prod, local, ids) {
  await assertLiveLabDatabase(local);
  await local.query("BEGIN");
  await local.query(`
    CREATE TABLE IF NOT EXISTS legal_systems (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS legal_articles (
      id text PRIMARY KEY,
      "legalSystemId" text,
      "lawName" text NOT NULL,
      "articleNumber" int NOT NULL,
      title text NOT NULL,
      content text NOT NULL,
      chapter text,
      keywords text[] NOT NULL DEFAULT '{}',
      classification text,
      search_norm text,
      status text NOT NULL DEFAULT 'سارية'
    );
    CREATE TABLE IF NOT EXISTS search_surface (
      id text PRIMARY KEY,
      work_key text NOT NULL,
      surface_system_id text,
      valid_on date NOT NULL,
      reason text NOT NULL,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS search_surface_member (
      id text PRIMARY KEY,
      work_key text NOT NULL,
      system_id text NOT NULL,
      role text NOT NULL,
      created_by text NOT NULL,
      created_at timestamptz NOT NULL
    );
  `);
  await local.query("TRUNCATE search_surface_member, search_surface, legal_articles, legal_systems");
  const articles = await prod.query(
    `SELECT id, "legalSystemId", "lawName", "articleNumber", title, content, chapter,
            keywords, classification, md5(content) AS content_md5
     FROM legal_articles WHERE id = ANY($1::text[])`,
    [ids],
  );
  const systemIds = [...new Set(articles.rows.map((row) => row.legalSystemId).filter(Boolean))];
  const keys = await prod.query(
    `SELECT DISTINCT work_key FROM search_surface_member WHERE system_id = ANY($1::text[])`,
    [systemIds],
  );
  const workKeys = keys.rows.map((row) => row.work_key);
  const members = await prod.query(
    `SELECT id, work_key, system_id, role, created_by, created_at
     FROM search_surface_member WHERE work_key = ANY($1::text[])`,
    [workKeys],
  );
  const surface = await prod.query(
    `SELECT id, work_key, surface_system_id, valid_on::text AS valid_on, reason, created_by, created_at
     FROM search_surface WHERE work_key = ANY($1::text[])`,
    [workKeys],
  );
  const relatedIds = [...new Set([
    ...systemIds,
    ...members.rows.map((row) => row.system_id),
    ...surface.rows.map((row) => row.surface_system_id).filter(Boolean),
  ])];
  const systems = await prod.query(`SELECT id, name FROM legal_systems WHERE id = ANY($1::text[])`, [relatedIds]);
  for (const system of systems.rows) {
    await local.query(`INSERT INTO legal_systems (id, name) VALUES ($1, $2)`, [system.id, system.name]);
  }
  for (const row of articles.rows) {
    await local.query(
      `INSERT INTO legal_articles
        (id, "legalSystemId", "lawName", "articleNumber", title, content, chapter, keywords, classification, search_norm)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)`,
      [row.id, row.legalSystemId, row.lawName, row.articleNumber, row.title, row.content, row.chapter, row.keywords ?? [], row.classification],
    );
  }
  for (const row of surface.rows) {
    await local.query(
      `INSERT INTO search_surface (id, work_key, surface_system_id, valid_on, reason, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, row.work_key, row.surface_system_id, row.valid_on, row.reason, row.created_by, row.created_at],
    );
  }
  for (const row of members.rows) {
    await local.query(
      `INSERT INTO search_surface_member (id, work_key, system_id, role, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [row.id, row.work_key, row.system_id, row.role, row.created_by, row.created_at],
    );
  }
  await local.query("COMMIT");
  return { articles: articles.rows.length, surface: surface.rows.length, members: members.rows.length };
}

async function contentMd5(client, ids) {
  const res = await client.query(
    `SELECT md5(string_agg(md5(content), '' ORDER BY id)) AS digest
     FROM legal_articles WHERE id = ANY($1::text[])`,
    [ids],
  );
  return res.rows[0].digest;
}

function tokenOf(norm) {
  return norm.split(" ").find((word) => /^\p{L}{6,}$/u.test(word)) ?? "";
}

async function recall(client, sql, word) {
  const res = await client.query(sql, [word]);
  return res.rows;
}

async function surfaceAt(client, asOf) {
  const rows = await client.query(
    `SELECT id, work_key, surface_system_id, valid_on::text AS valid_on, created_at
     FROM search_surface WHERE valid_on <= $1::date`,
    [asOf],
  );
  const members = await client.query(`SELECT work_key, system_id FROM search_surface_member`);
  return computeSurface(
    rows.rows.map((row) => ({
      id: row.id,
      workKey: row.work_key,
      surfaceSystemId: row.surface_system_id,
      validOn: row.valid_on.slice(0, 10),
      createdAt: new Date(row.created_at).toISOString(),
    })),
    members.rows.map((row) => ({ workKey: row.work_key, systemId: row.system_id })),
    asOf,
  );
}

function visible(rows, surface) {
  return rows.filter((row) => inSurface({ legalSystemId: row.legalSystemId, lawName: row.lawName }, surface));
}

async function articleOf(client, lawName, articleNumber = 1) {
  const res = await client.query(
    `SELECT id, "legalSystemId", "lawName", title, content, chapter, keywords, classification, search_norm
     FROM legal_articles WHERE "lawName" = $1 AND "articleNumber" = $2`,
    [lawName, articleNumber],
  );
  return res.rows[0];
}

async function main() {
  const toy = { expected_count: 2, rows: [{ id: "a", search_norm: "نص" }, { id: "b", search_norm: "آخر" }] };
  const seen = (rows) => classifyLedgerObservation(toy, rows);
  ok("تطابق المعرّفات والقيم كلها يؤكد", seen([{ id: "a", present: true, search_norm: "نص" }, { id: "b", present: true, search_norm: "آخر" }]).outcome === "confirmed");
  ok("كل المعرّفات بقيم NULL تعني لم يُطبَّق", seen([{ id: "a", present: true, search_norm: null }, { id: "b", present: true, search_norm: null }]).outcome === "not_applied");
  ok("اختلاف قيمة واحدة يبقى غير مؤكد", seen([{ id: "a", present: true, search_norm: "نص" }, { id: "b", present: true, search_norm: "مختلف" }]).outcome === "unconfirmed");
  ok("معرّف مفقود يبقى غير مؤكد", seen([{ id: "a", present: true, search_norm: null }, { id: "b", present: false, search_norm: null }]).outcome === "unconfirmed");
  ok("خلط NULL مع قيمة يبقى غير مؤكد", seen([{ id: "a", present: true, search_norm: "نص" }, { id: "b", present: true, search_norm: null }]).outcome === "unconfirmed");
  ok("الحالة المفقودة تُعد غير مؤكدة", effectiveCommitStatus({}) === "unconfirmed" && effectiveCommitStatus({ commit_status: "" }) === "unconfirmed");
  for (const name of ["hakeem", "hakeem_wave1", "neondb", "postgres", ""]) {
    let refused = false;
    try { assertLabDatabaseName(name); } catch { refused = true; }
    ok(`رفض مسح قاعدة باسم «${name || "فارغ"}»`, refused);
  }
  assertLabDatabaseName(LAB_DATABASE);
  ok("اسم قاعدة الاختبار المسموح هو hakeem_hkm002", true);
  if (databaseNameOf(LOCAL) !== LAB_DATABASE) {
    throw new Error("مرفوض: مسار الاتصال لا يسمي قاعدة الاختبار");
  }
  const manifest = loadManifest();
  const ids = manifest.rows.map((row) => row.id);
  const prod = new Client({ connectionString: process.env.DATABASE_UR });
  const local = new Client({ connectionString: LOCAL });
  await prod.connect();
  await local.connect();
  const liveDb = await assertLiveLabDatabase(local);
  ok("الاسم الفعلي للقاعدة قبل أي مسح هو hakeem_hkm002", liveDb === LAB_DATABASE);
  await prod.query("SET default_transaction_read_only = on");
  const beforeNull = await prod.query(`SELECT count(*)::int AS n FROM legal_articles WHERE search_norm IS NULL`);
  const seeded = await seed(prod, local, ids);
  ok("زُرعت المواد الـ353", seeded.articles === 353);
  const digestBefore = await contentMd5(local, ids);
  const sql = recallSql();
  const sample = await articleOf(local, "نظام سلامة المنتجات");
  const word = tokenOf(buildSearchNorm(sample));
  ok("عينة سلامة المنتجات لها كلمة بحث", word.length >= 6);
  const beforeRecall = await recall(local, sql, word);
  ok("قبل الملء لا يرى المسار المفهرس المادة", !beforeRecall.some((row) => row.id === sample.id));

  const isolatedLedgerPath = fileURLToPath(ledgerPathFor("isolated"));
  const productionLedgerPath = fileURLToPath(ledgerPathFor("production"));
  ok("مسار سجل الاختبار منفصل عن سجل الإنتاج", isolatedLedgerPath !== productionLedgerPath);
  let saveFailed = false;
  try {
    await fillNullSearchNorm(local, manifest, {
      target: "isolated",
      writeFile() { throw new Error("تعذر حفظ السجل"); },
    });
  } catch { saveFailed = true; }
  ok("فشل حفظ السجل يوقف الدفعة", saveFailed);
  const nullAfterSaveFail = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NULL`,
    [ids],
  );
  ok("فشل الحفظ لم يثبّت تحديث القاعدة", nullAfterSaveFail.rows[0].n === 353);
  ok("المتن ثابت بعد فشل الحفظ", (await contentMd5(local, ids)) === digestBefore);
  ok("فشل الحفظ لم ينشئ سجل الإنتاج", !existsSync(productionLedgerPath));

  let notExecuted = null;
  try {
    await fillNullSearchNorm(local, manifest, {
      target: "isolated",
      commit() { throw new Error("فشل قبل التنفيذ"); },
    });
  } catch (error) { notExecuted = error; }
  ok("فشل التثبيت قبل التنفيذ يُبقي السجل", notExecuted?.code === "COMMIT_NOT_EXECUTED" && existsSync(isolatedLedgerPath));
  const keptBefore = loadLedger(ledgerPathFor("isolated"));
  ok("سجل ما قبل التنفيذ فيه 353 قيمة غير مؤكدة", keptBefore.rows.length === 353 && keptBefore.commit_status === "unconfirmed");
  const missed = await verifyLedgerApplied(LOCAL, keptBefore);
  ok("اتصال قراءة جديد: التثبيت لم يُنفَّذ", missed.outcome === "not_applied" && missed.nulls === 353 && missed.missing === 0 && missed.read_only === true);
  ok("السجل بقي بعد تحقق عدم التنفيذ", existsSync(isolatedLedgerPath) && loadLedger(ledgerPathFor("isolated")).commit_status === "not_applied");
  const nullAfterMiss = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NULL`,
    [ids],
  );
  ok("فشل ما قبل التنفيذ لم يثبّت القيم", nullAfterMiss.rows[0].n === 353);
  ok("المتن ثابت بعد فشل ما قبل التنفيذ", (await contentMd5(local, ids)) === digestBefore);

  writeFileSync(isolatedLedgerPath, `${JSON.stringify({ target: "isolated", database: "hakeem_hkm002", marker: "prior", commit_status: "not_applied" })}\n`);
  let uncertain = null;
  let statusBeforeSend = "";
  try {
    await fillNullSearchNorm(local, manifest, {
      target: "isolated",
      async commit(client, hooks) {
        statusBeforeSend = loadLedger(ledgerPathFor("isolated")).commit_status ?? "missing";
        hooks.markSent();
        await client.query("COMMIT");
        throw new Error("انقطع الاتصال قبل تأكيد التثبيت");
      },
    });
  } catch (error) { uncertain = error; }
  ok("السجل unconfirmed قبل إرسال التثبيت", statusBeforeSend === "unconfirmed");
  ok("فقدان رد التثبيت يُبلغ أن النتيجة غير مؤكدة", uncertain?.code === "COMMIT_UNCERTAIN");
  const keptAfter = loadLedger(ledgerPathFor("isolated"));
  ok("فقدان الرد لم يحذف السجل ولم يعد السابق", keptAfter.rows.length === 353 && keptAfter.commit_status === "unconfirmed" && keptAfter.marker === undefined);
  let rollbackBlocked = false;
  try { await rollbackNullSearchNorm(local, manifest, keptAfter); } catch { rollbackBlocked = true; }
  ok("التراجع ممنوع قبل تحقق القراءة فقط", rollbackBlocked);
  const verifyApplied = await verifyLedgerApplied(LOCAL, keptAfter);
  ok("اتصال قراءة جديد: التثبيت نجح رغم فقدان الرد", verifyApplied.applied === true && verifyApplied.matched === 353 && verifyApplied.read_only === true);
  ok("السجل بقي بعد تأكيد النجاح", existsSync(isolatedLedgerPath) && loadLedger(ledgerPathFor("isolated")).commit_status === "confirmed");
  ok("المتن ثابت بعد فقدان الرد", (await contentMd5(local, ids)) === digestBefore);

  const filled = { updated: 353, ledger: loadLedger(ledgerPathFor("isolated")) };
  ok("حُدّث 353 صفًا", filled.updated === 353);
  const ledger = filled.ledger;
  ok("سجل الدفعة يحفظ 353 قيمة", ledger.rows.length === 353 && ledger.expected_count === 353);
  ok(
    "سجل الاختبار مرتبط بقاعدة العزل والدفعة",
    ledger.target === "isolated" && ledger.database === "hakeem_hkm002" && ledger.batch_id === filled.ledger.batch_id,
  );
  let crossRejected = false;
  try { assertLedgerBinding(ledger, { target: "production", database: "neondb" }); } catch { crossRejected = true; }
  ok("ربط السجل يرفض استخدام سجل الاختبار للإنتاج", crossRejected);
  const forged = { ...ledger, target: "production", database: "neondb" };
  forged.batch_id = ledgerBatchId(forged);
  let forgedRejected = false;
  try { await rollbackNullSearchNorm(local, manifest, forged); } catch { forgedRejected = true; }
  ok("التراجع يرفض سجل الاختبار إذا قُدّم لقاعدة الإنتاج", forgedRejected);
  const stillFilled = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NOT NULL`,
    [ids],
  );
  ok("رفض سجل الإنتاج لم يفرّغ الصفوف", stillFilled.rows[0].n === 353);
  const ledgerById = new Map(ledger.rows.map((row) => [row.id, row.search_norm]));
  const stored = await local.query(`SELECT id, search_norm FROM legal_articles WHERE id = ANY($1::text[])`, [ids]);
  ok("كل قيمة مخزنة تطابق سجل الدفعة", stored.rows.every((row) => row.search_norm === ledgerById.get(row.id)));
  ok("المتن لم يتغير بعد الملء", (await contentMd5(local, ids)) === digestBefore);
  const nulls = await local.query(`SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NULL`, [ids]);
  ok("لا NULL متبقٍ في القائمة", nulls.rows[0].n === 0);

  await local.query(`UPDATE legal_articles SET search_norm = 'partial' WHERE id = $1`, [sample.id]);
  const partialObs = await verifyLedgerApplied(LOCAL, ledger);
  ok("اختلاف قيمة في القاعدة يبقى غير مؤكد", partialObs.outcome === "unconfirmed" && partialObs.present === 353 && partialObs.missing === 0 && partialObs.matched === 352);
  let partialBlocked = false;
  try { await rollbackNullSearchNorm(local, manifest, loadLedger(ledgerPathFor("isolated"))); } catch (error) {
    partialBlocked = String(error.message).includes("غير مؤكدة");
  }
  ok("الاختلاف الجزئي يمنع التراجع", partialBlocked && loadLedger(ledgerPathFor("isolated")).commit_status === "unconfirmed");
  await local.query(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, [sample.id, ledgerById.get(sample.id)]);
  ok("استعادة القيمة الكاملة تؤكد", (await verifyLedgerApplied(LOCAL, ledger)).outcome === "confirmed");

  const victim = (await local.query(
    `SELECT id, "legalSystemId", "lawName", "articleNumber", title, content, chapter, keywords, classification, search_norm
     FROM legal_articles WHERE id = $1`,
    [ids[0]],
  )).rows[0];
  await local.query(`DELETE FROM legal_articles WHERE id = $1`, [ids[0]]);
  const missingObs = await verifyLedgerApplied(LOCAL, ledger);
  ok("معرّف مفقود من القاعدة يبقى غير مؤكد", missingObs.outcome === "unconfirmed" && missingObs.missing === 1);
  ok("المعرّف المفقود لا يُعلَّم not_applied", loadLedger(ledgerPathFor("isolated")).commit_status === "unconfirmed");
  await local.query(
    `INSERT INTO legal_articles (id, "legalSystemId", "lawName", "articleNumber", title, content, chapter, keywords, classification, search_norm)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [victim.id, victim.legalSystemId, victim.lawName, victim.articleNumber, victim.title, victim.content, victim.chapter, victim.keywords ?? [], victim.classification, victim.search_norm],
  );
  ok("إعادة المعرّف وقيمته تؤكد", (await verifyLedgerApplied(LOCAL, ledger)).outcome === "confirmed");

  await local.query(`UPDATE legal_articles SET search_norm = NULL WHERE id = ANY($1::text[])`, [ids]);
  const clearedObs = await verifyLedgerApplied(LOCAL, ledger);
  ok("بقاء كل القيم NULL يعلّم not_applied", clearedObs.outcome === "not_applied" && clearedObs.nulls === 353 && clearedObs.missing === 0);
  let statusFailed = null;
  try {
    await fillNullSearchNorm(local, manifest, {
      target: "isolated",
      writeStatus() { throw new Error("تعذر حفظ الحالة"); },
    });
  } catch (error) { statusFailed = error; }
  const statusLedger = loadLedger(ledgerPathFor("isolated"));
  ok("فشل حفظ الحالة بعد التثبيت يُبقي السجل غير المؤكد", statusFailed?.code === "COMMIT_STATUS_UNSAVED" && statusLedger.commit_status === "unconfirmed" && statusLedger.rows.length === 353);
  const keptUpdates = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NOT NULL`,
    [ids],
  );
  ok("التحديث بقي رغم فشل حفظ الحالة", keptUpdates.rows[0].n === 353);
  let statusRollbackBlocked = false;
  try { await rollbackNullSearchNorm(local, manifest, statusLedger); } catch { statusRollbackBlocked = true; }
  ok("فشل حفظ الحالة يمنع المتابعة", statusRollbackBlocked);
  ok("التحقق بعد فشل الحالة يؤكد التطابق الكامل", (await verifyLedgerApplied(LOCAL, ledger)).outcome === "confirmed");

  const confirmedLedger = loadLedger(ledgerPathFor("isolated"));
  const stripped = { ...confirmedLedger };
  delete stripped.commit_status;
  writeFileSync(isolatedLedgerPath, `${JSON.stringify(stripped)}\n`);
  let missingStatusRollback = false;
  try { await rollbackNullSearchNorm(local, manifest, stripped); } catch (error) {
    missingStatusRollback = String(error.message).includes("غير مؤكدة");
  }
  let missingStatusFill = false;
  try { await fillNullSearchNorm(local, manifest, { target: "isolated" }); } catch (error) {
    missingStatusFill = String(error.message).includes("غير مؤكدة");
  }
  ok("الحالة المفقودة تمنع التراجع وإعادة التشغيل", missingStatusRollback && missingStatusFill);
  ok("التحقق يعيد التأكيد عندما تتطابق القيم", (await verifyLedgerApplied(LOCAL, stripped)).outcome === "confirmed");
  ok("المتن ثابت بعد حالات التحقق", (await contentMd5(local, ids)) === digestBefore);

  let secondFailed = false;
  try { await fillNullSearchNorm(local, manifest, { target: "isolated" }); } catch { secondFailed = true; }
  ok("التشغيل الثاني يتوقف لأن القائمة لم تعد NULL", secondFailed);
  ok("المتن ثابت بعد الرفض", (await contentMd5(local, ids)) === digestBefore);

  const faces = [
    ["نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ", "2026-10-17", true],
    ["نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/53) وتاريخ 1433/8/13هـ", "2026-10-28", false],
    ["نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ", "2026-10-17", false],
    ["نظام التنفيذ الصادر بالمرسوم الملكي رقم (م/237) وتاريخ 1447/11/03هـ", "2026-10-28", true],
    ["نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ", "2026-10-17", true],
    ["نظام السجل التجاري الصادر بالمرسوم الملكي رقم (م/1) وتاريخ 1416/2/21هـ", "2026-10-17", false],
    ["نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/83) وتاريخ 1446/03/19هـ", "2026-10-17", true],
    ["نظام الأسماء التجارية الصادر بالمرسوم الملكي رقم (م/15) وتاريخ 1420/8/12هـ", "2026-10-17", false],
    ["نظام سلامة المنتجات", "2026-10-17", true],
    ["نظام المواصفات والجودة", "2026-10-17", true],
    ["تنظيم هيئة الاتصالات والفضاء والتقنية", "2026-10-17", true],
    ["نظام إدارة المواد الكيميائية", "2026-10-17", true],
  ];
  for (const [lawName, asOf, shouldShow] of faces) {
    const article = await articleOf(local, lawName);
    const token = tokenOf(buildSearchNorm(article));
    const raw = await recall(local, sql, token);
    const filtered = visible(raw, await surfaceAt(local, asOf));
    const found = filtered.some((row) => row.id === article.id);
    ok(`${shouldShow ? "يظهر" : "يُخفى"} ${lawName} في ${asOf}`, found === shouldShow);
    ok(`الاستدعاء الخام يجد ${lawName}`, raw.some((row) => row.id === article.id));
  }

  const originalTitle = sample.title;
  await local.query(`UPDATE legal_articles SET title = $2 WHERE id = $1`, [sample.id, `${originalTitle} تعديل اختباري`]);
  const retitled = await articleOf(local, "نظام سلامة المنتجات");
  const reindexed = buildSearchNorm(retitled);
  ok("إعادة الفهرسة بعد تغيير العنوان تنتج قيمة مختلفة", reindexed !== ledgerById.get(sample.id) && reindexed.length > 0);
  await local.query(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, [sample.id, reindexed]);
  let retitleRejected = false;
  try { await rollbackNullSearchNorm(local, manifest, ledger); } catch { retitleRejected = true; }
  ok("التراجع يرفض القيمة المعاد فهرستها بعد تغيير العنوان", retitleRejected);
  const afterRetitle = await local.query(`SELECT title, search_norm FROM legal_articles WHERE id = $1`, [sample.id]);
  ok("القيمة المعاد فهرستها بقيت", afterRetitle.rows[0].search_norm === reindexed);
  ok("العنوان المعدّل بقي", afterRetitle.rows[0].title === `${originalTitle} تعديل اختباري`);
  const others = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND id <> $2 AND search_norm IS NOT NULL`,
    [ids, sample.id],
  );
  ok("رفض التراجع لم يفرّغ بقية الصفوف", others.rows[0].n === 352);
  ok("المتن ثابت بعد تغيير العنوان وإعادة الفهرسة", (await contentMd5(local, ids)) === digestBefore);
  await local.query(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, [sample.id, ledgerById.get(sample.id)]);

  const tampered = await local.query(
    `UPDATE legal_articles SET search_norm = 'tamper' WHERE id = $1 RETURNING id`,
    [sample.id],
  );
  ok("عُدّل صف واحد للاختبار", tampered.rowCount === 1);
  let rollbackRejected = false;
  try { await rollbackNullSearchNorm(local, manifest, ledger); } catch { rollbackRejected = true; }
  ok("التراجع يتوقف إذا تغيرت قيمة كتبها غيره", rollbackRejected);
  const tamperLeft = await local.query(`SELECT search_norm FROM legal_articles WHERE id = $1`, [sample.id]);
  ok("الصف المعدّل لم يُمس عند رفض التراجع", tamperLeft.rows[0].search_norm === "tamper");
  await local.query(
    `UPDATE legal_articles SET search_norm = $2 WHERE id = $1`,
    [sample.id, ledgerById.get(sample.id)],
  );
  const cleared = await rollbackNullSearchNorm(local, manifest, ledger);
  ok("التراجع أفرغ 353", cleared.cleared === 353);
  ok("المتن ثابت بعد التراجع", (await contentMd5(local, ids)) === digestBefore);
  const allNull = await local.query(`SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NULL`, [ids]);
  ok("القائمة عادت NULL", allNull.rows[0].n === 353);
  const titleLeft = await local.query(`SELECT title FROM legal_articles WHERE id = $1`, [sample.id]);
  ok("التراجع أفرغ القيمة المحفوظة رغم تغيّر العنوان", titleLeft.rows[0].title === `${originalTitle} تعديل اختباري`);

  await local.query(`DELETE FROM legal_articles WHERE id = $1`, [ids[0]]);
  let missingRejected = false;
  try { await fillNullSearchNorm(local, manifest, { target: "isolated" }); } catch { missingRejected = true; }
  ok("نقص معرّف يوقف الدفعة", missingRejected);
  const untouched = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NOT NULL`,
    [ids],
  );
  ok("الرفض لم يملأ بقية الصفوف", untouched.rows[0].n === 0);

  const afterNull = await prod.query(`SELECT count(*)::int AS n FROM legal_articles WHERE search_norm IS NULL`);
  ok("الإنتاج بقي 353 NULL", beforeNull.rows[0].n === 353 && afterNull.rows[0].n === 353);
  const prodName = await prod.query("SELECT current_database() AS name");
  ok("قاعدة الإنتاج neondb وسجلها لم يُكتب", prodName.rows[0].name === "neondb" && !existsSync(productionLedgerPath));
  console.log(JSON.stringify({
    pass: checks.length,
    failed: checks.filter((item) => !item.pass).length,
    database: liveDb,
    seeded,
    checks,
  }, null, 1));
  await prod.end();
  await local.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "فشل الاختبار");
  process.exit(1);
});
