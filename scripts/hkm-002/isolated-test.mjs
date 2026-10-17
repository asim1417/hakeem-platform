/**
 * اختبار HKM-002 على قاعدة محلية فقط.
 * يقرأ نصوص الإنتاج بمعاملة READ ONLY ليزرع نسخة، ثم يكتب على 127.0.0.1.
 * لا يستدعي نقطة reindex العامة.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";
import { computeSurface, inSurface } from "../../lib/modules/legal-core/search-surface.ts";
import { fillNullSearchNorm, loadManifest } from "./fill-null-search-norm.mjs";
import { rollbackNullSearchNorm } from "./rollback-null-search-norm.mjs";

const LOCAL = process.env.HKM002_LOCAL_URL;
if (!LOCAL || !LOCAL.includes("@127.0.0.1:") && !LOCAL.includes("@localhost:")) {
  throw new Error("HKM002_LOCAL_URL يجب أن يشير إلى 127.0.0.1");
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
  const manifest = loadManifest();
  const ids = manifest.rows.map((row) => row.id);
  const prod = new Client({ connectionString: process.env.DATABASE_UR });
  const local = new Client({ connectionString: LOCAL });
  await prod.connect();
  await local.connect();
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

  const filled = await fillNullSearchNorm(local, manifest);
  ok("حُدّث 353 صفًا", filled.updated === 353);
  ok("المتن لم يتغير بعد الملء", (await contentMd5(local, ids)) === digestBefore);
  const nulls = await local.query(`SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NULL`, [ids]);
  ok("لا NULL متبقٍ في القائمة", nulls.rows[0].n === 0);

  let secondFailed = false;
  try { await fillNullSearchNorm(local, manifest); } catch { secondFailed = true; }
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

  const tampered = await local.query(
    `UPDATE legal_articles SET search_norm = 'tamper' WHERE id = $1 RETURNING id`,
    [sample.id],
  );
  ok("عُدّل صف واحد للاختبار", tampered.rowCount === 1);
  let rollbackRejected = false;
  try { await rollbackNullSearchNorm(local, manifest); } catch { rollbackRejected = true; }
  ok("التراجع يتوقف إذا تغيرت قيمة كتبها غيره", rollbackRejected);
  const tamperLeft = await local.query(`SELECT search_norm FROM legal_articles WHERE id = $1`, [sample.id]);
  ok("الصف المعدّل لم يُمس عند رفض التراجع", tamperLeft.rows[0].search_norm === "tamper");
  await local.query(
    `UPDATE legal_articles SET search_norm = $2 WHERE id = $1`,
    [sample.id, buildSearchNorm(sample)],
  );
  const cleared = await rollbackNullSearchNorm(local, manifest);
  ok("التراجع أفرغ 353", cleared.cleared === 353);
  ok("المتن ثابت بعد التراجع", (await contentMd5(local, ids)) === digestBefore);
  const allNull = await local.query(`SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NULL`, [ids]);
  ok("القائمة عادت NULL", allNull.rows[0].n === 353);

  await local.query(`DELETE FROM legal_articles WHERE id = $1`, [ids[0]]);
  let missingRejected = false;
  try { await fillNullSearchNorm(local, manifest); } catch { missingRejected = true; }
  ok("نقص معرّف يوقف الدفعة", missingRejected);
  const untouched = await local.query(
    `SELECT count(*)::int AS n FROM legal_articles WHERE id = ANY($1::text[]) AND search_norm IS NOT NULL`,
    [ids],
  );
  ok("الرفض لم يملأ بقية الصفوف", untouched.rows[0].n === 0);

  const afterNull = await prod.query(`SELECT count(*)::int AS n FROM legal_articles WHERE search_norm IS NULL`);
  ok("الإنتاج بقي 353 NULL", beforeNull.rows[0].n === 353 && afterNull.rows[0].n === 353);
  console.log(JSON.stringify({ pass: checks.length, failed: checks.filter((item) => !item.pass).length, seeded, checks }, null, 1));
  await prod.end();
  await local.end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : "فشل الاختبار");
  process.exit(1);
});
