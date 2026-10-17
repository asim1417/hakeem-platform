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
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";

export const MANIFEST_PATH = new URL("./expected-null-ids.json", import.meta.url);

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
export async function fillNullSearchNorm(client, manifest) {
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
    for (const row of locked.rows) {
      const norm = buildSearchNorm(articleFromRow(row));
      const updated = await client.query(
        `UPDATE legal_articles
         SET search_norm = $2
         WHERE id = $1 AND search_norm IS NULL
         RETURNING md5(content) AS content_md5`,
        [row.id, norm],
      );
      if (updated.rowCount !== 1) throw new Error("توقف: شرط NULL لم يطابق الصف");
      if (updated.rows[0].content_md5 !== expected.get(row.id).content_md5) {
        throw new Error("توقف: المتن تغيّر أثناء التحديث");
      }
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
    await client.query("COMMIT");
    return { updated: manifest.expected_count };
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
    const result = await fillNullSearchNorm(client, manifest);
    console.log(JSON.stringify({ target, updated: result.updated, expected: manifest.expected_count }));
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
