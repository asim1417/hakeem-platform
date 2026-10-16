/**
 * 03-segment-embeddings — متجهات الأسباب والمنطوق لكل حكم.
 *
 *   (بلا معامل) تشغيل جافّ للقراءة فقط: كم جزءًا وكم حرفًا وكم نداءً وكم التكلفة التقديرية.
 *               لا يستدعي مزوّد المتجهات ولا يكتب شيئًا. المخرج أعداد فقط (المستودع عام):
 *               reports/rulings-research/03-segment-embeddings.data.json
 *   --apply     توليد المتجهات وكتابتها في ruling_segment_embeddings وحده (judicial_cases لا يُمسّ):
 *               • هدف بحثي: NEON_RESEARCH_DATABASE_URL + CONFIRM_RESEARCH_WRITE=YES (ويُرفض مضيف الإنتاج)، أو
 *               • الإنتاج: CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED + OWNER_APPROVAL_REF (مرجع موافقة المالك).
 *               • MAX_EMBED_CALLS إلزامي: سقف نداءات المزوّد، يتوقف عنده.
 *               • يستأنف: ما طابقت بصمته (content_hash) لا يُعاد توليده.
 *
 * النص المرسَل إلى المزوّد محجوب (redactPII). لا يُطبع رابط ولا مفتاح ولا نص حكم.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { buildSegmentChunks, segmentContentHash, SEGMENT_EMBED_VERSION, type SegmentChunk } from "../../lib/rulings/research/segment-embeddings";
import { SEGMENT_EXTRACTOR_VERSION } from "../../lib/rulings/research/segment";
import { redactPII } from "../../lib/modules/legal-core/rulings-search";
import { EMBEDDING_DIMS, EMBEDDING_MODEL, embedBatch } from "../../lib/modules/ai/embeddings";
import { resolveWriteTarget } from "../../lib/rulings/research/write-target";

const APPLY = process.argv.includes("--apply");
const OUT = path.join(process.cwd(), "reports/rulings-research/03-segment-embeddings.data.json");
const MIGRATION = path.join(process.cwd(), "prisma/migrations/20261016150000_ruling_segment_embeddings/migration.sql");
const READ_BATCH = 500;
const EMBED_BATCH = 64; // مدخلات لكل نداء (≤ ٦٠٠٠ حرف لكل منها: دون حدّ الرموز للنداء الواحد)
const CHARS_PER_TOKEN = Number(process.env.CHARS_PER_TOKEN || 2.5);
const PRICE_PER_MTOK = Number(process.env.EMBED_PRICE_PER_MTOK || 0.02);


interface Tally {
  rulings: number; withReasons: number; withDisposition: number; withNeither: number;
  chunks: { reasons: number; disposition: number }; chars: { reasons: number; disposition: number };
  reasonsChunksPerRuling: Record<string, number>;
}
const tally = (): Tally => ({
  rulings: 0, withReasons: 0, withDisposition: 0, withNeither: 0,
  chunks: { reasons: 0, disposition: 0 }, chars: { reasons: 0, disposition: 0 }, reasonsChunksPerRuling: {},
});
function count(t: Tally, cs: SegmentChunk[]) {
  t.rulings++;
  const r = cs.filter((c) => c.part === "reasons").length;
  const d = cs.some((c) => c.part === "disposition");
  if (r) t.withReasons++;
  if (d) t.withDisposition++;
  if (!r && !d) t.withNeither++;
  t.reasonsChunksPerRuling[r] = (t.reasonsChunksPerRuling[r] ?? 0) + 1;
  for (const c of cs) {
    t.chunks[c.part]++;
    t.chars[c.part] += c.input.length;
  }
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 100 : 0);

function estimate(t: Tally) {
  const chunks = t.chunks.reasons + t.chunks.disposition;
  const chars = t.chars.reasons + t.chars.disposition;
  const tok = (ratio: number) => Math.round(chars / ratio);
  const usd = (n: number) => Math.round((n / 1e6) * PRICE_PER_MTOK * 100) / 100;
  return {
    model: EMBEDDING_MODEL, dims: EMBEDDING_DIMS, pricePerMTokUsd: PRICE_PER_MTOK,
    chunks, chars, calls: Math.ceil(chunks / EMBED_BATCH), inputsPerCall: EMBED_BATCH,
    tokens: { at2_0: tok(2.0), [`at${CHARS_PER_TOKEN}`]: tok(CHARS_PER_TOKEN), at3_0: tok(3.0) },
    costUsd: { high: usd(tok(2.0)), mid: usd(tok(CHARS_PER_TOKEN)), low: usd(tok(3.0)) },
  };
}

function report(t: Tally, extra: Record<string, unknown>) {
  const data = {
    measuredAt: new Date().toISOString(),
    mode: APPLY ? "apply" : "dry-run",
    segmentVersion: SEGMENT_EXTRACTOR_VERSION,
    embedVersion: SEGMENT_EMBED_VERSION,
    rulings: t.rulings,
    coveragePct: { reasons: pct(t.withReasons, t.rulings), disposition: pct(t.withDisposition, t.rulings), neither: pct(t.withNeither, t.rulings) },
    chunks: t.chunks,
    meanCharsPerChunk: {
      reasons: t.chunks.reasons ? Math.round(t.chars.reasons / t.chunks.reasons) : 0,
      disposition: t.chunks.disposition ? Math.round(t.chars.disposition / t.chunks.disposition) : 0,
    },
    reasonsChunksPerRuling: t.reasonsChunksPerRuling,
    estimate: estimate(t),
    ...extra,
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
  console.log(JSON.stringify({ rulings: data.rulings, coveragePct: data.coveragePct, estimate: data.estimate, ...extra }));
}

async function dryRun() {
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const t = tally();
    let last = "";
    for (;;) {
      const rows = await db.q<{ id: string; text: string | null }>(
        `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${READ_BATCH}`, last);
      if (!rows.length) break;
      for (const r of rows) count(t, buildSegmentChunks(r.text ?? "", redactPII));
      last = rows[rows.length - 1].id;
      process.stdout.write(`\r… ${t.rulings}`);
    }
    process.stdout.write("\n");
    const [tbl] = await db.q<{ exists: boolean }>(`SELECT to_regclass('public.ruling_segment_embeddings') IS NOT NULL AS exists`);
    let stored = 0;
    if (tbl?.exists) {
      const [c] = await db.q<{ c: string }>(`SELECT count(*)::text AS c FROM ruling_segment_embeddings`);
      stored = Number(c?.c ?? 0);
    }
    report(t, { tableExists: Boolean(tbl?.exists), storedChunks: stored });
  } finally {
    await db.close();
  }
}

function resolveTarget(): { url: string; kind: "research" | "production"; approval: string | null } {
  const maxCalls = Number(process.env.MAX_EMBED_CALLS);
  if (!Number.isFinite(maxCalls) || maxCalls <= 0) {
    console.error("🛑 MAX_EMBED_CALLS إلزامي (عدد موجب).");
    process.exit(1);
  }
  // الأقفال المشتركة (تفشل مغلقة إن لم يُعرف مضيف الإنتاج).
  return resolveWriteTarget();
}

async function apply() {
  const target = resolveTarget();
  const maxCalls = Number(process.env.MAX_EMBED_CALLS);
  if (!process.env.EMBEDDING_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error("🛑 لا مفتاح لمزوّد المتجهات.");
    process.exit(1);
  }
  const db = new PrismaClient({ datasources: { db: { url: target.url } }, log: ["error"] });
  console.log(`✍️ الهدف: ${target.kind}${target.approval ? ` — موافقة المالك: ${target.approval}` : ""} — سقف النداءات: ${maxCalls}`);
  const t = tally();
  let calls = 0, written = 0, skipped = 0, failed = 0, stopped = false;
  try {
    for (const stmt of readFileSync(MIGRATION, "utf8").split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean)) {
      await db.$executeRawUnsafe(stmt);
    }
    const pending: Array<{ id: string; c: SegmentChunk; hash: string }> = [];
    const flush = async () => {
      while (pending.length && !stopped) {
        if (calls >= maxCalls) {
          stopped = true;
          break;
        }
        const batch = pending.splice(0, EMBED_BATCH);
        calls++;
        const vecs = await embedBatch(batch.map((b) => b.c.input));
        // إدراج واحد متعدد الصفوف لكل دفعة (لا نداء قاعدة لكل جزء).
        const params: unknown[] = [];
        const values: string[] = [];
        for (let i = 0; i < batch.length; i++) {
          const v = vecs[i];
          if (!v || v.length !== EMBEDDING_DIMS) {
            failed++;
            continue;
          }
          const b = batch[i];
          const base = params.length;
          params.push(b.id, b.c.part, b.c.chunk, b.c.start, b.c.end, b.hash, `[${v.join(",")}]`,
            EMBEDDING_MODEL, SEGMENT_EMBED_VERSION, SEGMENT_EXTRACTOR_VERSION);
          values.push(`(${Array.from({ length: 10 }, (_, k) => `$${base + k + 1}${k === 6 ? "::vector" : ""}`).join(",")})`);
        }
        if (values.length) {
          await db.$executeRawUnsafe(
            `INSERT INTO ruling_segment_embeddings
               (ruling_id, part, chunk, start_char, end_char, content_hash, embedding, model, extractor_version, segment_version)
             VALUES ${values.join(",")}
             ON CONFLICT (ruling_id, part, chunk) DO UPDATE SET
               start_char=EXCLUDED.start_char, end_char=EXCLUDED.end_char, content_hash=EXCLUDED.content_hash,
               embedding=EXCLUDED.embedding, model=EXCLUDED.model, extractor_version=EXCLUDED.extractor_version,
               segment_version=EXCLUDED.segment_version, review_status='needs_review', created_at=now()`,
            ...params,
          );
          written += values.length;
        }
      }
    };
    let last = "";
    while (!stopped) {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; text: string | null }>>(
        `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${READ_BATCH}`, last);
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      const existing = await db.$queryRawUnsafe<Array<{ ruling_id: string; part: string; chunk: number; content_hash: string }>>(
        `SELECT ruling_id, part, chunk, content_hash FROM ruling_segment_embeddings WHERE ruling_id = ANY($1::text[])`, ids);
      const have = new Map(existing.map((e) => [`${e.ruling_id}|${e.part}|${e.chunk}`, e.content_hash]));
      for (const r of rows) {
        const cs = buildSegmentChunks(r.text ?? "", redactPII);
        count(t, cs);
        const keep = new Set(cs.map((c) => `${c.part}|${c.chunk}`));
        // أجزاء لم تعد موجودة بعد تغيّر التقطيع: تُحذف من هذا الجدول وحده.
        for (const e of existing) {
          if (e.ruling_id === r.id && !keep.has(`${e.part}|${e.chunk}`)) {
            await db.$executeRawUnsafe(`DELETE FROM ruling_segment_embeddings WHERE ruling_id=$1 AND part=$2 AND chunk=$3`, r.id, e.part, e.chunk);
          }
        }
        for (const c of cs) {
          const hash = segmentContentHash(c.input, EMBEDDING_MODEL);
          if (have.get(`${r.id}|${c.part}|${c.chunk}`) === hash) skipped++;
          else pending.push({ id: r.id, c, hash });
        }
      }
      if (pending.length >= EMBED_BATCH) await flush();
      last = rows[rows.length - 1].id;
      process.stdout.write(`\r… ${t.rulings} — نداءات ${calls} — كُتب ${written}`);
    }
    await flush();
    process.stdout.write("\n");
    report(t, { target: target.kind, calls, written, skipped, failed, stoppedAtCap: stopped });
  } finally {
    await db.$disconnect();
  }
}

(APPLY ? apply() : dryRun()).catch((e) => {
  console.error("✗", (e as Error).message);
  process.exit(1);
});
