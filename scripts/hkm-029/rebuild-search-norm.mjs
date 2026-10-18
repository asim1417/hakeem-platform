/**
 * HKM-029 — يعيد بناء search_norm لمعرّفات القائمة المجمّدة فقط (تعميم HKM-002 دون تغيير ملفاته).
 * لا يستدعي reindexSearchNorm ولا /api/admin/legal-core/reindex ولا backfill-search-norm --all.
 * لا يكتب content ولا title ولا أي عمود غير search_norm.
 *
 *   npx tsx scripts/hkm-029/rebuild-search-norm.mjs --target isolated
 *   npx tsx scripts/hkm-029/rebuild-search-norm.mjs --target production   (بإذن المالك وحراس البيئة)
 *
 * معاملة واحدة تقفل الصفوف (FOR UPDATE). تتوقف وتلغي الكل إذا اختلف العدد، أو غاب معرّف،
 * أو تغيّر النظام أو الرقم أو md5(content) أو md5(search_norm) منذ التجميد.
 * تكتب buildSearchNorm(row) بشرط md5(search_norm) المجمّد في جملة التحديث نفسها.
 * تحفظ السجل (القديم والجديد لكل صف) وتزامنه وتعيد قراءته قبل التثبيت. التشغيل الثاني مرفوض.
 */
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";
import { assertDatabaseForTarget, assertLockedRows, assertManifest, assertTarget, classifyObservation, ledgerBatchId, md5 } from "./drift-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MANIFEST_FILE = path.join(HERE, "expected-drift-ids.json");
const LEDGER_STATUSES = ["unconfirmed", "confirmed", "not_applied", "rolled_back"];

export function ledgerPathFor(target, dir = path.join(HERE, "ledgers")) {
  if (target !== "isolated" && target !== "production") throw new Error("هدف السجل غير معروف");
  return path.join(dir, `${target}.json`);
}

export function loadManifest(file = MANIFEST_FILE) {
  return assertManifest(JSON.parse(readFileSync(file, "utf8")));
}

export function assertLedger(ledger) {
  if (!ledger || ledger.batch !== "HKM-029" || !Array.isArray(ledger.rows) || ledger.rows.length !== ledger.expected_count) throw new Error("سجل الدفعة غير صالح");
  if (!LEDGER_STATUSES.includes(ledger.commit_status)) throw new Error("حالة السجل غير معروفة");
  assertDatabaseForTarget(ledger.target, ledger.database);
  if (ledger.batch_id !== ledgerBatchId(ledger)) throw new Error("معرّف الدفعة لا يطابق القيم");
  const ids = new Set(ledger.rows.map((r) => r.id));
  if (ids.size !== ledger.rows.length) throw new Error("سجل الدفعة فيه معرّف مكرر");
  for (const r of ledger.rows) {
    if (!r.id || typeof r.new_search_norm !== "string" || !r.new_search_norm) throw new Error("سجل الدفعة فيه فهرس جديد فارغ");
    if (!/^[0-9a-f]{32}$/.test(r.content_md5 ?? "")) throw new Error("سجل الدفعة بلا md5 للمتن");
  }
  return ledger;
}

function writeAtomic(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
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
  renameSync(tmp, file);
}

/** يكتب السجل ويعيد قراءته ويتحقق منه قبل أن يُسمح بالتثبيت. */
export function persistLedger(ledger, file) {
  assertLedger(ledger);
  const data = `${JSON.stringify(ledger)}\n`;
  writeAtomic(file, data);
  const loaded = assertLedger(JSON.parse(readFileSync(file, "utf8")));
  if (loaded.batch_id !== ledger.batch_id || loaded.commit_status !== ledger.commit_status) throw new Error("السجل المكتوب غير قابل للاسترجاع");
  return loaded;
}

export function loadLedger(file) {
  return assertLedger(JSON.parse(readFileSync(file, "utf8")));
}

export function markLedgerStatus(file, status) {
  if (!LEDGER_STATUSES.includes(status)) throw new Error("حالة غير معروفة");
  const ledger = loadLedger(file);
  return persistLedger({ ...ledger, commit_status: status }, file);
}

const articleOf = (r) => ({ lawName: r.lawName, title: r.title, content: r.content, keywords: r.keywords ?? [], classification: r.classification, chapter: r.chapter });

/**
 * يعيد البناء داخل معاملة واحدة. أي اختلاف يلغي الكل. لا يطبع نصوصًا.
 * options: { target, ledgerFile, commit(client) } — commit للاختبار فقط.
 */
export async function rebuildSearchNorm(client, manifest, options) {
  const target = options.target;
  const ledgerFile = options.ledgerFile ?? ledgerPathFor(target);
  assertManifest(manifest);
  if (manifest.expected_count === 0) throw new Error("توقف: القائمة المجمّدة فارغة؛ لا شيء يُعاد بناؤه");
  if (existsSync(ledgerFile)) throw new Error("توقف: سجل دفعة سابق موجود. تحقق منه أو تراجع، ثم انقله قبل أي تشغيل جديد");
  const live = await client.query("SELECT current_database() AS name");
  const database = live.rows[0].name;
  assertDatabaseForTarget(target, database);
  const ids = manifest.rows.map((r) => r.id);
  await client.query("BEGIN");
  let ledger;
  try {
    const locked = await client.query(
      `SELECT id, "lawName", "articleNumber", "articleBis", title, content, keywords, classification, chapter, search_norm,
              md5(content) AS content_md5, CASE WHEN search_norm IS NULL THEN NULL ELSE md5(search_norm) END AS search_norm_md5
         FROM legal_articles WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [ids],
    );
    assertLockedRows(manifest, locked.rows);
    const rows = [];
    for (const row of locked.rows) {
      const next = buildSearchNorm(articleOf(row));
      if (!next) throw new Error("توقف: ناتج التطبيع فارغ");
      if (next === row.search_norm) throw new Error("توقف: صف في القائمة فهرسه صحيح أصلًا");
      const frozen = manifest.rows.find((m) => m.id === row.id);
      const updated = await client.query(
        `UPDATE legal_articles SET search_norm = $2
          WHERE id = $1 AND md5(content) = $3 AND (CASE WHEN search_norm IS NULL THEN '' ELSE md5(search_norm) END) = $4
          RETURNING md5(content) AS content_md5, search_norm`,
        [row.id, next, frozen.content_md5, frozen.search_norm_md5 ?? ""],
      );
      if (updated.rowCount !== 1) throw new Error("توقف: شرط البصمة المجمّدة لم يطابق الصف");
      if (updated.rows[0].content_md5 !== frozen.content_md5 || updated.rows[0].search_norm !== next) throw new Error("توقف: القيمة العائدة تختلف عن المكتوب");
      rows.push({ id: row.id, content_md5: frozen.content_md5, old_search_norm: row.search_norm, new_search_norm: next });
    }
    rows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    ledger = { batch: "HKM-029", target, database, expected_count: manifest.expected_count, rows, commit_status: "unconfirmed" };
    ledger.batch_id = ledgerBatchId(ledger);
    const after = await client.query(
      `SELECT count(*)::int AS n,
              count(*) FILTER (WHERE a.search_norm = t.new_norm)::int AS new_ok,
              count(*) FILTER (WHERE md5(a.content) = t.content_md5)::int AS text_ok
         FROM legal_articles a JOIN unnest($1::text[], $2::text[], $3::text[]) AS t(id, new_norm, content_md5) ON t.id = a.id`,
      [rows.map((r) => r.id), rows.map((r) => r.new_search_norm), rows.map((r) => r.content_md5)],
    );
    const c = after.rows[0];
    if (c.n !== manifest.expected_count || c.new_ok !== manifest.expected_count || c.text_ok !== manifest.expected_count) throw new Error("توقف: التحقق الختامي لم يطابق القائمة");
    persistLedger(ledger, ledgerFile);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
  try {
    if (options.commit) await options.commit(client);
    else await client.query("COMMIT");
  } catch (error) {
    // السجل محفوظ بحالة غير مؤكدة: التحقق بالقراءة يحسم قبل أي إعادة أو تراجع.
    throw Object.assign(new Error("نتيجة التثبيت غير مؤكدة. السجل محفوظ. شغّل verify-search-norm قبل أي خطوة"), { code: "COMMIT_UNCERTAIN", cause: error });
  }
  return { status: "committed", updated: ledger.rows.length, batch_id: ledger.batch_id, database, ledgerFile };
}

/** اتصال جديد قراءة فقط: confirmed أو not_applied أو unconfirmed. يحدّث حالة السجل. */
export async function verifyLedger(connectionString, ledgerFile) {
  const ledger = loadLedger(ledgerFile);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query("SET default_transaction_read_only = on");
    const db = await client.query("SELECT current_database() AS name");
    if (db.rows[0].name !== ledger.database) throw new Error("قاعدة التحقق تختلف عن سجل الدفعة");
    const found = await client.query(
      `SELECT t.id, (a.id IS NOT NULL) AS present, a.search_norm FROM unnest($1::text[]) AS t(id) LEFT JOIN legal_articles a ON a.id = t.id`,
      [ledger.rows.map((r) => r.id)],
    );
    const result = classifyObservation(ledger, found.rows);
    if (ledger.commit_status !== "rolled_back") markLedgerStatus(ledgerFile, result.outcome);
    const ro = await client.query("SHOW transaction_read_only");
    return { database: db.rows[0].name, ...result, expected: ledger.expected_count, read_only: ro.rows[0].transaction_read_only === "on" };
  } finally {
    await client.end();
  }
}

export { md5 };

async function main() {
  const i = process.argv.indexOf("--target");
  const target = i >= 0 ? process.argv[i + 1] : "";
  const manifest = loadManifest();
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  assertTarget(target, url, manifest.expected_count);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await rebuildSearchNorm(client, manifest, { target });
    console.log(JSON.stringify({ status: result.status, target, database: result.database, batch_id: result.batch_id, updated: result.updated }));
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "فشل");
    process.exit(error?.code === "COMMIT_UNCERTAIN" ? 2 : 1);
  });
}
