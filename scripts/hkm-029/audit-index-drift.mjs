/**
 * HKM-029 — جرد انحراف فهارس المواد عن نصها الحالي. قراءة فقط (معاملة READ ONLY).
 *   npm run audit:index-drift -- [--date YYYY-MM-DD] [--out <dir>] [--freeze] [--scope shifted,content_changed]
 *                                [--opensearch] [--fail-on-drift]
 *
 * ١. search_norm: المتوقع = buildSearchNorm(الصف) مقابل المخزَّن، والفرق مصنّف (drift-lib.mjs):
 *    shifted (يساوي فهرس مادة أخرى في النظام)، whitespace_only، content_changed، empty.
 * ٢. المتجهات: بصمة content_hash في embeddings مقابل بصمة نص التضمين الحالي (embeddingTextHashes = buildEmbeddingText)
 *    (وبصمة النص قبل الحجب للمتجهات القديمة السليمة)، فتصنَّف fresh أو fresh_legacy أو stale أو missing.
 * ٣. OpenSearch (اختياري بـ --opensearch وOPENSEARCH_URL): _mget قراءةً لمستندات كل المواد.
 *
 * المخرجات أعداد ومعرّفات وأرقام مواد فقط، بلا نصوص: <out>/hkm-029-index-drift.json و.md.
 * --freeze يكتب scripts/hkm-029/expected-drift-ids.json (القائمة المجمّدة) من الجرد نفسه.
 * لا يطبع سلسلة الاتصال، ولا يكتب على القاعدة ولا على OpenSearch.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "pg";
import { buildSearchNorm } from "../../lib/modules/legal-core/search-norm.ts";
import { DEFAULT_SCOPE, buildManifest, classifyDrift, embeddingTextHashes, openSearchStatus, summarizeDrift, vectorStatus, versionStatus } from "./drift-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MANIFEST_FILE = path.join(HERE, "expected-drift-ids.json");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/** يقرأ الصفوف والبصمات في معاملة واحدة REPEATABLE READ وREAD ONLY (لقطة متسقة لكل الاستعلامات). */
export async function loadSnapshot(client) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const db = await client.query(
      "SELECT current_database() AS name, now() AS at, (CASE WHEN pg_is_in_recovery() THEN pg_last_wal_replay_lsn() ELSE pg_current_wal_lsn() END)::text AS lsn",
    );
    const articles = await client.query(
      `SELECT a.id, a."lawName", a."articleNumber", a."articleBis", a.title, a.content, a.keywords,
              a.classification, a.chapter, a.search_norm, s.name AS system_name
         FROM legal_articles a LEFT JOIN legal_systems s ON s.id = a."legalSystemId"`,
    );
    const vectors = await client.query(`SELECT owner_id, content_hash FROM embeddings WHERE owner_type = 'article'`);
    // أحدث نسخة في embedding_version لكل مادة: البحث يقدّمها على embeddings (vector-provider).
    const hasVersions = (await client.query("SELECT to_regclass('public.embedding_version') IS NOT NULL AS ok")).rows[0].ok;
    const versions = hasVersions
      ? (await client.query(`SELECT DISTINCT ON (owner_id) owner_id, content_hash, model FROM embedding_version WHERE owner_type = 'article' ORDER BY owner_id, created_at DESC`)).rows
      : [];
    const ro = await client.query("SHOW transaction_read_only");
    const iso = await client.query("SHOW transaction_isolation");
    await client.query("COMMIT");
    return {
      database: db.rows[0].name,
      at: db.rows[0].at,
      lsn: db.rows[0].lsn,
      readOnly: ro.rows[0].transaction_read_only === "on",
      isolation: iso.rows[0].transaction_isolation,
      articles: articles.rows,
      vectors: vectors.rows,
      versions,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

const expectedNorm = (r) =>
  buildSearchNorm({ lawName: r.lawName, title: r.title, content: r.content, keywords: r.keywords ?? [], classification: r.classification, chapter: r.chapter });

/** الجرد من لقطة: الفهرس اللفظي والمتجهات (OpenSearch يُضاف لاحقًا إن طُلب). */
export function auditSnapshot(snapshot) {
  const rows = snapshot.articles.map((r) => ({ ...r, articleNumber: Number(r.articleNumber), articleBis: Number(r.articleBis ?? 0) }));
  const drift = classifyDrift(rows.map((r) => ({ id: r.id, lawName: r.lawName, articleNumber: r.articleNumber, articleBis: r.articleBis, stored: r.search_norm, expected: expectedNorm(r) })));
  const hashes = new Map(snapshot.vectors.map((v) => [v.owner_id, v.content_hash]));
  const versions = new Map((snapshot.versions ?? []).map((v) => [v.owner_id, v]));
  const vectors = { fresh: 0, fresh_legacy: 0, stale: 0, missing: 0 };
  const source = { version: 0, embeddings: 0 };
  const staleVectors = [];
  const vectorByLaw = {};
  // المتجه الفعّال: أحدث نسخة في embedding_version إن وُجدت، وإلا صف embeddings.
  const statusOf = (r) => {
    const parts = { systemName: r.system_name ?? r.lawName, title: r.title, content: r.content };
    const v = versions.get(r.id);
    if (v) return versionStatus(v.content_hash, v.model, parts);
    const h = embeddingTextHashes(parts);
    return vectorStatus(hashes.get(r.id) ?? null, h.current, h.legacy);
  };
  for (const r of rows) {
    if (versions.has(r.id)) source.version += 1;
    else if (hashes.has(r.id)) source.embeddings += 1;
  }
  for (const r of rows) {
    const status = statusOf(r);
    vectors[status] += 1;
    if (status === "stale") {
      staleVectors.push({ id: r.id, lawName: r.lawName, articleNumber: r.articleNumber, articleBis: r.articleBis });
      vectorByLaw[r.lawName] = (vectorByLaw[r.lawName] ?? 0) + 1;
    }
  }
  const driftIds = new Set(drift.map((d) => d.id));
  const driftVectors = { fresh: 0, fresh_legacy: 0, stale: 0, missing: 0 };
  for (const r of rows) if (driftIds.has(r.id)) driftVectors[statusOf(r)] += 1;
  staleVectors.sort((a, b) => a.lawName.localeCompare(b.lawName, "ar") || a.articleNumber - b.articleNumber || a.articleBis - b.articleBis);
  return {
    articles: rows.length,
    searchNorm: summarizeDrift(drift),
    drift,
    vectors: { ...vectors, total: snapshot.vectors.length, versions: (snapshot.versions ?? []).length, source, byLaw: vectorByLaw, onDriftedRows: driftVectors },
    staleVectors,
    rows,
  };
}

/**
 * فحص OpenSearch بالقراءة فقط: _mget لمستندات «article:<id>» (كل المواد افتراضًا)، ومقارنة العنوان والمتن والرقم
 * واسم النظام. articleBis ليس في المستند، والمعرّف يميّز الصف. لا تُطبع بيانات الاتصال في أي خطأ.
 */
export async function auditOpenSearch(rows, ids, env = process.env, fetchImpl = fetch) {
  const raw = (env.OPENSEARCH_URL || "").trim().replace(/\/$/, "");
  if (!raw) return { status: "not_run", reason: "OPENSEARCH_URL غير مضبوط" };
  let base;
  let user = env.OPENSEARCH_USERNAME || "";
  let pass = env.OPENSEARCH_PASSWORD ?? "";
  try {
    const u = new URL(raw);
    if (u.username) {
      user = user || decodeURIComponent(u.username);
      pass = pass || decodeURIComponent(u.password);
    }
    u.username = "";
    u.password = "";
    base = u.toString().replace(/\/$/, "");
  } catch {
    return { status: "error", reason: "OPENSEARCH_URL غير صالح" };
  }
  const index = env.OPENSEARCH_INDEX_LEGAL_ARTICLES || "legal_articles";
  const headers = { "content-type": "application/json" };
  if (user) headers.authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const counts = { fresh: 0, stale: 0, missing: 0 };
  const stale = [];
  const list = [...ids];
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500);
    let res;
    try {
      res = await fetchImpl(`${base}/${index}/_mget?_source=title,content,articleNumber,lawName`, { method: "POST", headers, body: JSON.stringify({ ids: chunk.map((id) => `article:${id}`) }) });
    } catch (error) {
      return { status: "error", reason: `تعذّر الاتصال (${error?.cause?.code ?? error?.name ?? "fetch"})`, checked: i };
    }
    if (!res.ok) return { status: "error", reason: `HTTP ${res.status}`, checked: i };
    const body = await res.json();
    for (const doc of body.docs ?? []) {
      const id = String(doc._id).replace(/^article:/, "");
      const row = byId.get(id);
      if (!row) continue;
      const st = openSearchStatus(doc.found ? doc._source : null, row);
      counts[st] += 1;
      if (st !== "fresh") stale.push({ id, lawName: row.lawName, articleNumber: row.articleNumber, status: st });
    }
  }
  return { status: "ok", index, checked: list.length, ...counts, notFresh: stale };
}

function markdown(report) {
  const s = report.search_norm;
  const v = report.vectors;
  const lines = [
    `# HKM-029 — جرد انحراف فهارس المواد (${report.date})`,
    "",
    `القاعدة: ${report.database}، اللقطة ${report.snapshot_at} (LSN ${report.snapshot_lsn})، قراءة فقط: ${report.read_only ? "نعم" : "لا"}.`,
    `المواد: ${report.articles}.`,
    "",
    "## search_norm",
    `المختلف ${s.total}: منزاح ${s.byCategory.shifted}، مسافات فقط ${s.byCategory.whitespace_only}، نص تغيّر ${s.byCategory.content_changed}، فارغ ${s.byCategory.empty}.`,
    ...Object.entries(s.byLaw).map(([law, c]) => `- ${law}: منزاح ${c.shifted}، مسافات ${c.whitespace_only}، نص ${c.content_changed}، فارغ ${c.empty}`),
    "",
    "## المتجهات",
    `متجهات المواد ${v.total} (ونسخ embedding_version ${v.versions}): سليمة ${v.fresh}، سليمة قبل الحجب ${v.fresh_legacy}، قديمة ${v.stale}، مواد بلا متجه ${v.missing}.`,
    ...Object.entries(v.byLaw).sort((a, b) => b[1] - a[1]).map(([law, n]) => `- ${law}: ${n} قديم`),
    "",
    "## OpenSearch",
    report.opensearch.status === "ok"
      ? `فُحص ${report.opensearch.checked}: سليم ${report.opensearch.fresh}، قديم ${report.opensearch.stale}، مفقود ${report.opensearch.missing}.`
      : `لم يُشغَّل: ${report.opensearch.reason}.`,
    "",
    `القائمة المجمّدة (${report.scope.join("، ")}): ${report.frozen_count} صفًّا.`,
  ];
  return lines.join("\n") + "\n";
}

export function buildReport(audit, snapshot, { date, scope, opensearch }) {
  return {
    task: "HKM-029",
    date,
    database: snapshot.database,
    snapshot_at: new Date(snapshot.at).toISOString(),
    snapshot_lsn: snapshot.lsn,
    read_only: snapshot.readOnly,
    isolation: snapshot.isolation,
    articles: audit.articles,
    scope,
    frozen_count: audit.drift.filter((d) => scope.includes(d.category)).length,
    search_norm: audit.searchNorm,
    drift: audit.drift,
    vectors: audit.vectors,
    stale_vectors: audit.staleVectors,
    opensearch,
  };
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  const date = arg("--date", new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("--date بصيغة YYYY-MM-DD");
  const scope = (arg("--scope") ?? DEFAULT_SCOPE.join(",")).split(",").map((x) => x.trim()).filter(Boolean);
  const out = arg("--out", path.join(process.cwd(), "reports/project-control", date));
  const client = new Client({ connectionString: url });
  await client.connect();
  let snapshot;
  try {
    snapshot = await loadSnapshot(client);
  } finally {
    await client.end();
  }
  if (!snapshot.readOnly || snapshot.isolation !== "repeatable read") throw new Error("توقف: اللقطة لم تُقرأ في معاملة REPEATABLE READ وREAD ONLY");
  const audit = auditSnapshot(snapshot);
  const osIds = new Set(audit.rows.map((r) => r.id));
  const opensearch = process.argv.includes("--opensearch") ? await auditOpenSearch(audit.rows, osIds) : { status: "not_run", reason: "لم يُطلب (--opensearch)" };
  const report = buildReport(audit, snapshot, { date, scope, opensearch });
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "hkm-029-index-drift.json"), JSON.stringify(report, null, 1) + "\n");
  writeFileSync(path.join(out, "hkm-029-index-drift.md"), markdown(report));
  if (process.argv.includes("--freeze")) {
    const manifest = buildManifest({ drift: audit.drift, rows: audit.rows, scope, source: `audit-index-drift ${snapshot.database} LSN ${snapshot.lsn}`, frozenAt: report.snapshot_at });
    writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 1) + "\n");
  }
  console.log(JSON.stringify({ database: snapshot.database, articles: audit.articles, search_norm: audit.searchNorm.byCategory, vectors: { fresh: audit.vectors.fresh, fresh_legacy: audit.vectors.fresh_legacy, stale: audit.vectors.stale, missing: audit.vectors.missing }, opensearch: opensearch.status, frozen: report.frozen_count }));
  if (process.argv.includes("--fail-on-drift") && report.frozen_count > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "فشل");
    process.exit(2);
  });
}
