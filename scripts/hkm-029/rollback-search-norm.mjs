/**
 * HKM-029 — يتراجع عن دفعة rebuild-search-norm بسجلها: يعيد search_norm القديم حرفيًّا
 * حيث الحالي يساوي الجديد في السجل وmd5(content) مطابق. أي اختلاف يلغي الكل.
 *   npx tsx scripts/hkm-029/rollback-search-norm.mjs --target isolated|production
 * الإنتاج بحراس البيئة نفسها (HAKEEM_INJECT وHAKEEM_INDEX_APPLY وHAKEEM_APPROVED_ROWS والمضيف).
 */
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { assertDatabaseForTarget, assertTarget } from "./drift-lib.mjs";
import { ledgerPathFor, loadLedger, markLedgerStatus } from "./rebuild-search-norm.mjs";

export async function rollbackSearchNorm(client, ledgerFile, options = {}) {
  const ledger = loadLedger(ledgerFile);
  if (ledger.commit_status === "rolled_back") throw new Error("توقف: الدفعة متراجع عنها سابقًا");
  if (ledger.commit_status === "not_applied") throw new Error("توقف: الدفعة لم تُطبَّق أصلًا");
  const live = await client.query("SELECT current_database() AS name");
  assertDatabaseForTarget(ledger.target, live.rows[0].name);
  if (live.rows[0].name !== ledger.database) throw new Error("توقف: القاعدة لا تطابق سجل الدفعة");
  await client.query("BEGIN");
  try {
    const locked = await client.query(
      `SELECT id, search_norm, md5(content) AS content_md5 FROM legal_articles WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [ledger.rows.map((r) => r.id)],
    );
    if (locked.rows.length !== ledger.expected_count) throw new Error(`توقف: العدد ${locked.rows.length} ≠ ${ledger.expected_count}`);
    const byId = new Map(locked.rows.map((r) => [r.id, r]));
    for (const exp of ledger.rows) {
      const row = byId.get(exp.id);
      if (!row) throw new Error("توقف: معرّف غائب");
      if (row.content_md5 !== exp.content_md5) throw new Error("توقف: نص مادة تغيّر بعد الدفعة");
      if (row.search_norm !== exp.new_search_norm) throw new Error("توقف: فهرس صف تغيّر بعد الدفعة؛ لا تراجع جزئي");
    }
    for (const exp of ledger.rows) {
      const res = await client.query(
        `UPDATE legal_articles SET search_norm = $2 WHERE id = $1 AND search_norm = $3 AND md5(content) = $4 RETURNING search_norm`,
        [exp.id, exp.old_search_norm, exp.new_search_norm, exp.content_md5],
      );
      if (res.rowCount !== 1 || (res.rows[0].search_norm ?? null) !== (exp.old_search_norm ?? null)) throw new Error("توقف: شرط التراجع لم يطابق الصف");
    }
    if (options.commit) await options.commit(client);
    else await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
  markLedgerStatus(ledgerFile, "rolled_back");
  return { status: "rolled_back", restored: ledger.rows.length, batch_id: ledger.batch_id };
}

async function main() {
  const i = process.argv.indexOf("--target");
  const target = i >= 0 ? process.argv[i + 1] : "";
  const ledgerFile = ledgerPathFor(target);
  const ledger = loadLedger(ledgerFile);
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  assertTarget(target, url, ledger.expected_count);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    console.log(JSON.stringify({ target, ...(await rollbackSearchNorm(client, ledgerFile)) }));
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
