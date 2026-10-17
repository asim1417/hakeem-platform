/**
 * HKM-002 — تراجع ملء search_norm للقائمة المجمّدة.
 * يفرّغ العمود فقط إذا كانت قيمته مطابقة حرفيًا لما حفظته الدفعة في سجلها.
 * لا يعيد حساب التطبيع من الحقول الحالية. أي قيمة تغيّرت بعد الكتابة تُلغي المعاملة كلها.
 *
 *   node --experimental-strip-types --import ./scripts/hkm-002/ts-resolve.mjs scripts/hkm-002/rollback-null-search-norm.mjs --target isolated
 */
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { assertLedgerBinding, assertTarget, ledgerPathFor, loadLedger, loadManifest } from "./fill-null-search-norm.mjs";

export async function rollbackNullSearchNorm(client, manifest, ledger) {
  if (ledger?.commit_status === "unconfirmed") {
    throw new Error("توقف: نتيجة التثبيت غير مؤكدة. تحقق بالقراءة فقط قبل التراجع");
  }
  const live = await client.query("SELECT current_database() AS name");
  assertLedgerBinding(ledger, { target: ledger.target, database: live.rows[0].name });
  const ids = manifest.rows.map((row) => row.id);
  const expected = new Map(manifest.rows.map((row) => [row.id, row]));
  if (ledger?.batch !== "HKM-002" || ledger.expected_count !== manifest.expected_count || ledger.rows?.length !== manifest.expected_count) {
    throw new Error("توقف: سجل الدفعة لا يطابق القائمة المتوقعة");
  }
  const saved = new Map(ledger.rows.map((row) => [row.id, row.search_norm]));
  if (saved.size !== manifest.expected_count) throw new Error("توقف: سجل الدفعة فيه معرّف مكرر");
  for (const id of ids) {
    if (typeof saved.get(id) !== "string" || saved.get(id).length === 0) {
      throw new Error("توقف: سجل الدفعة ينقصه معرّف أو قيمة");
    }
  }
  await client.query("BEGIN");
  try {
    const locked = await client.query(
      `SELECT id, "lawName", "articleNumber", search_norm, md5(content) AS content_md5
       FROM legal_articles
       WHERE id = ANY($1::text[])
       FOR UPDATE`,
      [ids],
    );
    if (locked.rows.length !== manifest.expected_count) {
      throw new Error(`توقف: العدد ${locked.rows.length} ≠ المتوقع ${manifest.expected_count}`);
    }
    for (const [id, exp] of expected) {
      const row = locked.rows.find((item) => item.id === id);
      if (!row) throw new Error("توقف: معرّف غائب من القاعدة");
      if (row.lawName !== exp.lawName || Number(row.articleNumber) !== exp.articleNumber) {
        throw new Error("توقف: اسم النظام أو رقم المادة تغيّر");
      }
      if (row.content_md5 !== exp.content_md5) throw new Error("توقف: نص مادة مستهدفة تغيّر");
      if (row.search_norm !== saved.get(id)) throw new Error("توقف: قيمة search_norm تغيّرت بعد الدفعة");
      const updated = await client.query(
        `UPDATE legal_articles
         SET search_norm = NULL
         WHERE id = $1 AND search_norm = $2
         RETURNING md5(content) AS content_md5`,
        [row.id, saved.get(id)],
      );
      if (updated.rowCount !== 1) throw new Error("توقف: قيمة search_norm لم تعد قيمة الدفعة");
      if (updated.rows[0].content_md5 !== exp.content_md5) throw new Error("توقف: المتن تغيّر أثناء التراجع");
    }
    const after = await client.query(
      `SELECT count(*) FILTER (WHERE search_norm IS NULL)::int AS nulls
       FROM legal_articles WHERE id = ANY($1::text[])`,
      [ids],
    );
    if (after.rows[0].nulls !== manifest.expected_count) throw new Error("توقف: لم تُفرَّغ القائمة كلها");
    await client.query("COMMIT");
    return { cleared: manifest.expected_count };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  const target = process.argv.includes("--target")
    ? process.argv[process.argv.indexOf("--target") + 1]
    : "";
  const manifest = loadManifest();
  const ledger = loadLedger(ledgerPathFor(target));
  const url = target === "production" ? process.env.DATABASE_UR ?? "" : process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("سلسلة الاتصال غير مضبوطة للهدف");
  assertTarget(target, url, manifest.expected_count);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await rollbackNullSearchNorm(client, manifest, ledger);
    console.log(JSON.stringify({ target, cleared: result.cleared, expected: manifest.expected_count }));
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
