/**
 * HKM-002 — تراجع ملء search_norm للقائمة المجمّدة.
 * يعيد العمود إلى NULL فقط إذا كانت قيمته هي ناتج التطبيع الحالي للصف
 * (أي القيمة التي يكتبها fill). إذا تغيّر المتن أو قيمة الفهرس، تُلغى المعاملة كلها.
 *
 *   node --experimental-strip-types scripts/hkm-002/rollback-null-search-norm.mjs --target isolated
 */
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";
import { assertTarget, loadManifest } from "./fill-null-search-norm.mjs";

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

export async function rollbackNullSearchNorm(client, manifest) {
  const ids = manifest.rows.map((row) => row.id);
  const expected = new Map(manifest.rows.map((row) => [row.id, row]));
  await client.query("BEGIN");
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
    for (const [id, exp] of expected) {
      const row = locked.rows.find((item) => item.id === id);
      if (!row) throw new Error("توقف: معرّف غائب من القاعدة");
      if (row.lawName !== exp.lawName || Number(row.articleNumber) !== exp.articleNumber) {
        throw new Error("توقف: اسم النظام أو رقم المادة تغيّر");
      }
      if (row.content_md5 !== exp.content_md5) throw new Error("توقف: نص مادة مستهدفة تغيّر");
      const written = buildSearchNorm(articleFromRow(row));
      const updated = await client.query(
        `UPDATE legal_articles
         SET search_norm = NULL
         WHERE id = $1 AND search_norm = $2
         RETURNING md5(content) AS content_md5`,
        [row.id, written],
      );
      if (updated.rowCount !== 1) throw new Error("توقف: قيمة search_norm ليست ناتج هذه الدفعة");
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
  const url = target === "production" ? process.env.DATABASE_UR ?? "" : process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("سلسلة الاتصال غير مضبوطة للهدف");
  assertTarget(target, url, manifest.expected_count);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await rollbackNullSearchNorm(client, manifest);
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
