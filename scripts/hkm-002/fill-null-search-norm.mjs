/**
 * HKM-002 — يملأ search_norm لمعرّفات القائمة المجمّدة فقط.
 * لا يستدعي reindexSearchNorm ولا نقطة /api/admin/legal-core/reindex.
 * يحدّث الصف فقط إذا بقي search_norm فارغًا (NULL).
 * يتوقف ويلغي المعاملة إذا تغيّر العدد، أو قائمة المعرّفات، أو نص المادة.
 *
 *   node --experimental-strip-types scripts/hkm-002/fill-null-search-norm.mjs --target isolated
 * الإنتاج غير مُشغَّل من هذه المراجعة. --target production يرفض الكتابة
 * ما لم تُضبط حراس الإذن صراحةً، ولم تُضبط في الاختبار.
 */
import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";

export const MANIFEST_PATH = new URL("./expected-null-ids.json", import.meta.url);
export const ISOLATED_DATABASE = "hakeem_hkm002";
export const PRODUCTION_DATABASE = "neondb";

export function ledgerPathFor(target) {
  if (target !== "isolated" && target !== "production") throw new Error("هدف السجل غير معروف");
  return new URL(`./ledgers/${target}.json`, import.meta.url);
}

export function loadManifest(path = MANIFEST_PATH) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const ids = manifest.rows.map((row) => row.id);
  if (!Number.isInteger(manifest.expected_count) || ids.length !== manifest.expected_count) {
    throw new Error("القائمة المجمّدة غير متسقة: العدد لا يطابق الصفوف");
  }
  if (new Set(ids).size !== ids.length) throw new Error("القائمة المجمّدة فيها معرّف مكرر");
  return manifest;
}

export function hostOf(url) {
  const afterAt = url.split("@").pop() ?? "";
  return afterAt.split("/")[0].split("?")[0].split(":")[0];
}

/** يرفض أي هدف غير المعزول ما لم تُفتح بوابة الإنتاج بكل حراسها. لا تطبع سلسلة الاتصال. */
export function assertTarget(target, url, expectedCount) {
  const host = hostOf(url);
  if (target === "isolated") {
    if (host !== "127.0.0.1" && host !== "localhost") {
      throw new Error("مرفوض: الهدف المعزول يقبل 127.0.0.1 أو localhost فقط");
    }
    return;
  }
  if (target !== "production") throw new Error("مرفوض: الهدف غير معروف");
  const approved = process.env.HAKEEM_INJECT === "yes"
    && process.env.HAKEEM_INDEX_APPLY === "yes"
    && process.env.HAKEEM_APPROVED_ROWS === String(expectedCount);
  if (!approved || !host.includes("ep-icy-rice") || !host.endsWith(".neon.tech")) {
    throw new Error("مرفوض: تطبيق الإنتاج غير مفتوح. اعرض المراجعة أولًا، ثم اضبط الإذن والعدد المطابق للقائمة");
  }
}

function articleFromRow(row) {
  return {
    lawName: row.lawName,
    title: row.title,
    content: row.content,
    keywords: row.keywords ?? [],
    classification: row.classification,
    chapter: row.chapter,
  };
}

/**
 * يملأ القائمة داخل معاملة واحدة. عند أي اختلاف يُلغي الكل ولا يترك تحديثًا جزئيًا.
 * يعيد عدد الصفوف المحدَّثة. لا يطبع المتون.
 */
export async function fillNullSearchNorm(client, manifest, options = {}) {
  const target = options.target;
  if (target !== "isolated" && target !== "production") throw new Error("هدف السجل غير معروف");
  const live = await client.query("SELECT current_database() AS name");
  const database = live.rows[0].name;
  assertDatabaseForTarget(target, database);
  const ids = manifest.rows.map((row) => row.id);
  const expected = new Map(manifest.rows.map((row) => [row.id, row]));
  const ledgerFile = fileURLToPath(ledgerPathFor(target));
  if (existsSync(ledgerFile)) {
    try {
      const pending = JSON.parse(readFileSync(ledgerFile, "utf8"));
      if (pending?.commit_status === "unconfirmed" && pending.target === target && pending.database === database) {
        throw new Error("توقف: نتيجة تثبيت سابقة غير مؤكدة. تحقق بالقراءة فقط قبل إعادة التشغيل");
      }
    } catch (error) {
      if (String(error?.message || "").includes("غير مؤكدة")) throw error;
    }
  }
  await client.query("BEGIN");
  let ledger;
  try {
    const locked = await client.query(
      `SELECT id, "lawName", "articleNumber", title, content, chapter, keywords, classification,
              search_norm, md5(content) AS content_md5
       FROM legal_articles
       WHERE id = ANY($1::text[])
       FOR UPDATE`,
      [ids],
    );
    if (locked.rows.length !== manifest.expected_count) {
      throw new Error(`توقف: العدد ${locked.rows.length} ≠ المتوقع ${manifest.expected_count}`);
    }
    const nullSet = await client.query(`SELECT id FROM legal_articles WHERE search_norm IS NULL`);
    if (nullSet.rows.length !== manifest.expected_count) {
      throw new Error(`توقف: عدد الصفوف الفارغة ${nullSet.rows.length} ≠ المتوقع ${manifest.expected_count}`);
    }
    const seen = new Set(locked.rows.map((row) => row.id));
    if (seen.size !== expected.size) throw new Error("توقف: قائمة المعرّفات تغيّرت");
    for (const row of nullSet.rows) {
      if (!expected.has(row.id)) throw new Error("توقف: ظهرت مادة فارغة خارج القائمة المتوقعة");
    }
    for (const [id, exp] of expected) {
      const row = locked.rows.find((item) => item.id === id);
      if (!row) throw new Error("توقف: معرّف غائب من القاعدة");
      if (row.lawName !== exp.lawName || Number(row.articleNumber) !== exp.articleNumber) {
        throw new Error("توقف: اسم النظام أو رقم المادة تغيّر");
      }
      if (row.content_md5 !== exp.content_md5) throw new Error("توقف: نص مادة مستهدفة تغيّر");
      if (row.search_norm !== null) throw new Error("توقف: search_norm لم يعد NULL في القائمة المتوقعة");
    }
    const written = [];
    for (const row of locked.rows) {
      const norm = buildSearchNorm(articleFromRow(row));
      if (!norm) throw new Error("توقف: ناتج التطبيع فارغ");
      const updated = await client.query(
        `UPDATE legal_articles
         SET search_norm = $2
         WHERE id = $1 AND search_norm IS NULL
         RETURNING md5(content) AS content_md5, search_norm`,
        [row.id, norm],
      );
      if (updated.rowCount !== 1) throw new Error("توقف: شرط NULL لم يطابق الصف");
      if (updated.rows[0].content_md5 !== expected.get(row.id).content_md5) {
        throw new Error("توقف: المتن تغيّر أثناء التحديث");
      }
      if (updated.rows[0].search_norm !== norm) throw new Error("توقف: القيمة العائدة تختلف عن المكتوب");
      written.push({ id: row.id, search_norm: norm });
    }
    written.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    ledger = {
      batch: "HKM-002",
      batch_id: ledgerBatchId({ target, database, rows: written }),
      target,
      database,
      expected_count: manifest.expected_count,
      rows: written,
    };
    const stored = await client.query(
      `SELECT id, search_norm FROM legal_articles WHERE id = ANY($1::text[])`,
      [ids],
    );
    const storedById = new Map(stored.rows.map((row) => [row.id, row.search_norm]));
    if (storedById.size !== written.length) throw new Error("توقف: سجل القيم لا يطابق الصفوف المخزنة");
    for (const row of written) {
      if (storedById.get(row.id) !== row.search_norm) throw new Error("توقف: سجل الدفعة يختلف عما استقر في الصف");
    }
    const after = await client.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE search_norm IS NULL)::int AS still_null,
              count(*) FILTER (WHERE md5(content) = src.content_md5)::int AS text_ok
       FROM legal_articles a
       JOIN (
         SELECT * FROM unnest($1::text[], $2::text[]) AS t(id, content_md5)
       ) src ON src.id = a.id`,
      [ids, manifest.rows.map((row) => row.content_md5)],
    );
    const check = after.rows[0];
    if (check.n !== manifest.expected_count || check.still_null !== 0 || check.text_ok !== manifest.expected_count) {
      throw new Error("توقف: التحقق الختامي لم يطابق القائمة");
    }
    persistLedger(ledger, ledgerPathFor(target), options);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return finishCommit(client, ledger, options);
}

async function defaultCommit(client, hooks) {
  hooks.markSent();
  await client.query("COMMIT");
}

/** بعد حفظ السجل: إرسال التثبيت منفصل عن ما قبله. خطأ بعد الإرسال لا يحذف السجل. */
async function finishCommit(client, ledger, options) {
  let commitSent = false;
  const hooks = { markSent() { commitSent = true; } };
  try {
    const commit = options.commit ?? defaultCommit;
    await commit(client, hooks);
    const confirmed = markLedgerStatus(ledgerPathFor(ledger.target), "confirmed");
    return { updated: ledger.expected_count, ledger: confirmed, status: "committed" };
  } catch (error) {
    if (error?.code === "COMMIT_UNCERTAIN" || error?.code === "COMMIT_NOT_EXECUTED") throw error;
    if (!commitSent) {
      try { await client.query("ROLLBACK"); } catch { /* المعاملة قد تكون أُغلقت */ }
      const kept = keepLedger(ledger, "unconfirmed");
      throw new CommitOutcomeError(
        "COMMIT_NOT_EXECUTED",
        "فشل التثبيت قبل التنفيذ. السجل محفوظ. تحقق بالقراءة فقط قبل أي إعادة تشغيل أو تراجع",
        kept,
      );
    }
    const kept = keepLedger(ledger, "unconfirmed");
    throw new CommitOutcomeError(
      "COMMIT_UNCERTAIN",
      "نتيجة التثبيت غير مؤكدة: أُرسل الأمر ولم يصل تأكيد. السجل محفوظ. تحقق بالقراءة فقط قبل أي إعادة تشغيل أو تراجع",
      kept,
    );
  }
}

export class CommitOutcomeError extends Error {
  constructor(code, message, ledger) {
    super(message);
    this.code = code;
    this.ledger = ledger;
  }
}

function keepLedger(ledger, status) {
  try {
    return markLedgerStatus(ledgerPathFor(ledger.target), status);
  } catch {
    return ledger;
  }
}

export function assertDatabaseForTarget(target, database) {
  if (target === "isolated" && database === ISOLATED_DATABASE) return;
  if (target === "production" && database === PRODUCTION_DATABASE) return;
  throw new Error(`مرفوض: الهدف ${target} لا يطابق القاعدة ${database}`);
}

export function ledgerBatchId(core) {
  const hash = createHash("sha256");
  hash.update(core.target);
  hash.update("\0");
  hash.update(core.database);
  hash.update("\0");
  for (const row of core.rows) {
    hash.update(row.id);
    hash.update("\0");
    hash.update(row.search_norm);
    hash.update("\n");
  }
  return hash.digest("hex");
}

export function assertLedger(ledger) {
  if (!ledger || ledger.batch !== "HKM-002" || !Array.isArray(ledger.rows) || ledger.rows.length !== ledger.expected_count) {
    throw new Error("سجل الدفعة غير صالح");
  }
  if (ledger.target !== "isolated" && ledger.target !== "production") throw new Error("سجل بلا هدف");
  if (typeof ledger.database !== "string" || ledger.database.length === 0) throw new Error("سجل بلا قاعدة");
  if (typeof ledger.batch_id !== "string" || !/^[a-f0-9]{64}$/.test(ledger.batch_id)) throw new Error("سجل بلا دفعة");
  if (ledger.commit_status !== undefined && !["confirmed", "unconfirmed", "not_applied"].includes(ledger.commit_status)) {
    throw new Error("حالة السجل غير معروفة");
  }
  if (ledger.batch_id !== ledgerBatchId(ledger)) throw new Error("معرّف الدفعة لا يطابق القيم");
  assertDatabaseForTarget(ledger.target, ledger.database);
  const ids = new Set(ledger.rows.map((row) => row.id));
  if (ids.size !== ledger.rows.length) throw new Error("سجل الدفعة فيه معرّف مكرر");
  for (const row of ledger.rows) {
    if (!row.id || typeof row.search_norm !== "string" || row.search_norm.length === 0) {
      throw new Error("سجل الدفعة فيه قيمة فهرس فارغة");
    }
  }
  return ledger;
}

export function assertLedgerBinding(ledger, expected) {
  assertLedger(ledger);
  if (ledger.target !== expected.target || ledger.database !== expected.database) {
    throw new Error("مرفوض: السجل لا يخص قاعدة التشغيل وهذه الدفعة");
  }
  return ledger;
}

function restoreLedgerFile(path, prior) {
  if (prior) writeFileSync(path, prior);
  else if (existsSync(path)) unlinkSync(path);
}

function writeLedgerAtomic(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  const fd = openSync(tmp, "w");
  try {
    writeSync(fd, data);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  if (readFileSync(tmp, "utf8") !== data) {
    unlinkSync(tmp);
    throw new Error("قراءة السجل المؤقت لا تطابق المكتوب");
  }
  renameSync(tmp, path);
}

/** يكتب السجل ويثبت قراءته قبل أن يُسمَح بتثبيت تحديث القاعدة. فشل الحفظ يُعيد الملف السابق. */
export function persistLedger(ledger, path, options = {}) {
  assertLedger(ledger);
  const actualPath = path instanceof URL ? fileURLToPath(path) : path;
  const expectedPath = fileURLToPath(ledgerPathFor(ledger.target));
  if (actualPath !== expectedPath) throw new Error("مرفوض: مسار السجل لا يطابق الهدف");
  const prior = existsSync(actualPath) ? readFileSync(actualPath) : null;
  if (prior) {
    const existing = JSON.parse(prior.toString("utf8"));
    if (existing.target !== ledger.target || existing.database !== ledger.database) {
      throw new Error("مرفوض: استبدال سجل قاعدة أو هدف آخر");
    }
  }
  const payload = `${JSON.stringify(ledger)}\n`;
  const writeFile = options.writeFile ?? writeLedgerAtomic;
  try {
    writeFile(actualPath, payload);
    const loaded = assertLedger(JSON.parse(readFileSync(actualPath, "utf8")));
    assertLedgerBinding(loaded, { target: ledger.target, database: ledger.database });
    if (loaded.batch_id !== ledger.batch_id || loaded.rows.length !== ledger.rows.length) {
      throw new Error("السجل المكتوب غير قابل للاسترجاع");
    }
    for (let i = 0; i < ledger.rows.length; i += 1) {
      if (loaded.rows[i].id !== ledger.rows[i].id || loaded.rows[i].search_norm !== ledger.rows[i].search_norm) {
        throw new Error("السجل المسترجع يختلف عن المكتوب");
      }
    }
    return loaded;
  } catch (error) {
    restoreLedgerFile(actualPath, prior);
    throw error;
  }
}

export function loadLedger(path) {
  return assertLedger(JSON.parse(readFileSync(path, "utf8")));
}

/** يغيّر حالة السجل دون المساس بقيم الدفعة أو استبداله بسجل أقدم. */
export function markLedgerStatus(path, status) {
  const actual = path instanceof URL ? fileURLToPath(path) : path;
  const ledger = loadLedger(actual);
  if (!["confirmed", "unconfirmed", "not_applied"].includes(status)) throw new Error("حالة غير معروفة");
  const next = { ...ledger, commit_status: status };
  writeLedgerAtomic(actual, `${JSON.stringify(next)}\n`);
  const loaded = loadLedger(actual);
  if (loaded.commit_status !== status || loaded.batch_id !== ledger.batch_id || loaded.rows.length !== ledger.rows.length) {
    throw new Error("تعذر تثبيت حالة السجل");
  }
  return loaded;
}

/** اتصال جديد للقراءة فقط. يقارن القيم المستهدفة بالسجل ولا يكتب في القاعدة. */
export async function verifyLedgerApplied(connectionString, ledger) {
  assertLedger(ledger);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("SET default_transaction_read_only = on");
    const db = await client.query("SELECT current_database() AS name");
    if (db.rows[0].name !== ledger.database) throw new Error("قاعدة التحقق تختلف عن سجل الدفعة");
    const found = await client.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE a.search_norm = src.search_norm)::int AS matched
       FROM legal_articles a
       JOIN (SELECT * FROM unnest($1::text[], $2::text[]) AS t(id, search_norm)) src ON src.id = a.id`,
      [ledger.rows.map((row) => row.id), ledger.rows.map((row) => row.search_norm)],
    );
    const row = found.rows[0];
    const applied = row.n === ledger.expected_count && row.matched === ledger.expected_count;
    markLedgerStatus(ledgerPathFor(ledger.target), applied ? "confirmed" : "not_applied");
    const mode = await client.query("SHOW transaction_read_only");
    return {
      database: db.rows[0].name,
      matched: row.matched,
      expected: ledger.expected_count,
      applied,
      read_only: mode.rows[0].transaction_read_only === "on",
    };
  } finally {
    await client.end();
  }
}

async function main() {
  const target = process.argv.includes("--target")
    ? process.argv[process.argv.indexOf("--target") + 1]
    : "";
  const manifest = loadManifest();
  const url = target === "production" ? process.env.DATABASE_UR ?? "" : process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("سلسلة الاتصال غير مضبوطة للهدف");
  assertTarget(target, url, manifest.expected_count);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await fillNullSearchNorm(client, manifest, { target });
    console.log(JSON.stringify({
      status: result.status,
      target,
      database: result.ledger.database,
      batch_id: result.ledger.batch_id,
      updated: result.updated,
      expected: manifest.expected_count,
      ledger_rows: result.ledger.rows.length,
    }));
  } catch (error) {
    if (error?.code === "COMMIT_UNCERTAIN" || error?.code === "COMMIT_NOT_EXECUTED") {
      console.error(JSON.stringify({
        status: "unconfirmed",
        code: error.code,
        database: error.ledger?.database,
        batch_id: error.ledger?.batch_id,
        ledger_rows: error.ledger?.rows?.length ?? 0,
      }));
      process.exitCode = 2;
      return;
    }
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "فشل");
    process.exit(1);
  });
}
