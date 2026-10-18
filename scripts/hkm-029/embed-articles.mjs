/**
 * HKM-029 — إعادة بناء متجهات المواد القديمة (ومتجهي المادتين 19 و26 من نظام المحاكم التجارية) بقائمة مجمّدة.
 *
 * يضيف صفوفًا في embedding_version فقط (جدول إضافة فقط بمشغّل)، ولا يمس embeddings ولا legal_articles.
 * البحث يقرأ أحدث نسخة لكل مادة (lib/modules/legal-search/vector-source.ts)، فيحل الجديد محل القديم دون حذفه.
 *
 *   تجريب (افتراضي): يقرأ في لقطة REPEATABLE READ READ ONLY، ويطابق الاختيار الحي بالقائمة المجمّدة،
 *     ويحسب النصوص والبصمات، ويجرّب نداءً واحدًا لنموذج التضمين (الطول 1536). لا يكتب شيئًا.
 *   كتابة (--apply --approved-rows <العدد>): يولّد كل المتجهات أولًا ويتحقق منها، ثم معاملة واحدة تقفل
 *     الصفوف (FOR SHARE) وتعيد بصمة الحالة وتشترط ألا نسخة بالبصمة نفسها، ثم تُدرج وتتحقق ثم تثبّت.
 *     أي اختلاف أو فشل نداء قبل المعاملة = لا كتابة.
 *
 *   npx tsx scripts/hkm-029/embed-articles.mjs [--apply --approved-rows 940]
 *   على الإنتاج يلزم: CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED، والعدد المعتمد = القائمة.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import {
  EMBED_BATCH,
  EMBED_MODEL,
  ROWS_SQL,
  STATE_FOR_IDS_SQL,
  SUMMARY_SQL,
  assertEmbedManifest,
  assertSummaryMatches,
  assertVectors,
  chunk,
  embedTargetGate,
  parseEmbedArgs,
  vectorLiteral,
} from "./embed-lib.mjs";

export const DEFAULT_MANIFEST = new URL("./embed-manifest.json", import.meta.url);

export function loadEmbedManifest(file = DEFAULT_MANIFEST) {
  return assertEmbedManifest(JSON.parse(readFileSync(file, "utf8")));
}

/** قراءة اللقطة ومطابقتها بالقائمة، وحساب النصوص والبصمات بالكود. */
/** deps: { buildText, fingerprint } */
export async function readSelection(client, manifest, deps) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const live = (await client.query(SUMMARY_SQL)).rows[0];
    assertSummaryMatches(manifest, live);
    const rows = (await client.query(ROWS_SQL)).rows;
    if (rows.length !== manifest.selected) throw new Error(`توقف: الصفوف ${rows.length} ≠ ${manifest.selected}`);
    const items = rows.map((r) => {
      const text = deps.buildText({ systemName: r.system_name, title: r.title, content: r.content });
      return { id: r.id, status: r.status, text, hash: deps.fingerprint(text), sqlHash: r.vfp };
    });
    if (items.some((x) => !x.text.trim())) throw new Error("توقف: نص تضمين فارغ");
    return { live, items };
  } finally {
    await client.query("ROLLBACK").catch(() => {});
  }
}

/**
 * deps: { embed(texts) → متجهات بالترتيب (null للفشل)، buildText(parts)، fingerprint(text) }
 * opts: { apply, approvedRows, url, env }
 */
export async function runEmbed(client, manifest, deps, opts) {
  const gate = embedTargetGate(opts.url, { apply: opts.apply, approvedRows: opts.approvedRows, expected: manifest.selected, env: opts.env ?? process.env });
  const live = await client.query("SELECT current_database() AS db");
  if (live.rows[0].db !== gate.database) throw new Error("مرفوض: القاعدة المتصلة لا تطابق رابط الاتصال");

  const { items } = await readSelection(client, manifest, deps);
  const sqlMismatch = items.filter((x) => x.hash !== x.sqlHash).length;
  const chars = items.reduce((n, x) => n + x.text.length, 0);
  const summary = { target: gate.target, selected: items.length, stale: manifest.stale, missing: manifest.missing, sql_hash_mismatch: sqlMismatch, chars, approx_tokens: Math.ceil(chars / 2.5), model: EMBED_MODEL };

  if (!opts.apply) {
    // تجربة المسار كاملًا بلا كتابة: نداء واحد قصير يثبت المفتاح والنموذج والطول.
    const probe = await deps.embed(["اختبار مسار التضمين"]);
    assertVectors(probe, 1);
    return { ...summary, mode: "dry-run", probe: "ok", written: 0 };
  }

  // ١) كل المتجهات قبل أي كتابة.
  const vectors = [];
  for (const batch of chunk(items, EMBED_BATCH)) vectors.push(...(await deps.embed(batch.map((x) => x.text))));
  assertVectors(vectors, items.length);

  // ٢) معاملة واحدة: قفل، وإعادة البصمة، وشرط عدم التكرار، وإدراج، وتحقق.
  const ids = items.map((x) => x.id);
  const hashes = items.map((x) => x.hash);
  await client.query("BEGIN");
  try {
    const locked = await client.query(`SELECT id FROM legal_articles WHERE id = ANY($1::text[]) FOR SHARE`, [ids]);
    if (locked.rowCount !== ids.length) throw new Error("توقف: مادة غائبة عند القفل");
    const st = (await client.query(STATE_FOR_IDS_SQL, [ids])).rows[0];
    if (st.n !== ids.length || st.state_md5 !== manifest.state_md5) throw new Error("توقف: نص مادة تغيّر بين القراءة والكتابة");
    const dup = await client.query(
      `SELECT count(*)::int AS n FROM embedding_version WHERE owner_type = 'article' AND owner_id = ANY($1::text[]) AND content_hash = ANY($2::text[])`,
      [ids, hashes],
    );
    if (dup.rows[0].n !== 0) throw new Error("توقف: نسخة بالبصمة نفسها موجودة (تشغيل ثانٍ؟)");
    for (const part of chunk(items.map((x, i) => ({ ...x, v: vectors[i] })), 200)) {
      await client.query(
        `INSERT INTO embedding_version (id, owner_type, owner_id, embedding, model, content_hash, created_at)
         SELECT x.id, 'article', x.owner_id, x.emb::vector, $5, x.hash, now()
         FROM unnest($1::text[], $2::text[], $3::text[], $4::text[]) AS x(id, owner_id, emb, hash)`,
        [part.map(() => randomUUID()), part.map((x) => x.id), part.map((x) => vectorLiteral(x.v)), part.map((x) => x.hash), EMBED_MODEL],
      );
    }
    const check = (
      await client.query(
        `SELECT count(*)::int AS n FROM (
           SELECT DISTINCT ON (owner_id) owner_id, content_hash, created_at FROM embedding_version
           WHERE owner_type = 'article' AND owner_id = ANY($1::text[]) ORDER BY owner_id, created_at DESC
         ) l JOIN unnest($1::text[], $2::text[]) AS x(id, hash) ON x.id = l.owner_id
         WHERE l.content_hash = x.hash AND l.created_at = now()`, // now() ثابت داخل المعاملة = وقت الإدراج
        [ids, hashes],
      )
    ).rows[0].n;
    if (check !== ids.length) throw new Error(`توقف: التحقق ${check} ≠ ${ids.length}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
  return { ...summary, mode: "apply", written: items.length };
}

/** الأدوات الحقيقية: buildEmbeddingText وembeddingFingerprint وembedBatch من كود المنصة. */
export async function realDeps() {
  const { buildEmbeddingText, embedBatch } = await import("../../lib/modules/ai/embeddings.ts");
  const { embeddingFingerprint } = await import("../../lib/modules/legal-core/embedding-fingerprint.ts");
  return { embed: embedBatch, buildText: buildEmbeddingText, fingerprint: (t) => embeddingFingerprint(t) };
}

/** override: { apply, approvedRows } من مسار backfill-embeddings.yml (فرع التشغيل). */
export async function main(argv = process.argv.slice(2), override = undefined) {
  const args = override ?? parseEmbedArgs(argv);
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL غير مضبوط");
  const manifest = loadEmbedManifest();
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await runEmbed(client, manifest, await realDeps(), { apply: args.apply, approvedRows: args.approvedRows, url });
    console.log(JSON.stringify(result));
    return result;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : "فشل");
      process.exit(1);
    });
}
