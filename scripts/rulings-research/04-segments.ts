/**
 * 04-segments — حفظ أجزاء كل حكم (ruling_segments) من التقطيع بالقواعد.
 *
 *   (بلا معامل) تشغيل جافّ للقراءة فقط: كم صفًّا وكم حرفًا للأسباب والمنطوق المفهرسين. بلا كتابة.
 *   --apply     كتابة ruling_segments وحده (judicial_cases لا يُمسّ) بأقفال write-target:
 *               فرع بحثي، أو الإنتاج بموافقة المالك المسجّلة. يستأنف: الحكم الذي طابقت بصمةُ نصه
 *               وإصدارُ التقطيع المحفوظَين لا يُعاد.
 *
 * part_norm (للأسباب والمنطوق فقط) = نص الجزء محجوبًا ومطبَّعًا كما يُبنى search_norm، ليُرتَّب البحث
 * اللفظي بما ورد في علّة الحكم ونتيجته. الإزاحات على النص الأصلي. المخرج أعداد فقط (المستودع عام):
 * reports/rulings-research/04-segments.data.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertReadOnly, openReadOnlyDb, type QueryFn } from "../../lib/rulings/audit/readonly-db";
import { SEGMENT_EXTRACTOR_VERSION } from "../../lib/rulings/research/segment";
import { segmentRows, type SegmentRow } from "../../lib/rulings/research/segment-store";
import { applyMigration, META_SEGMENTS_MIGRATION, resolveWriteTarget } from "../../lib/rulings/research/write-target";

const APPLY = process.argv.includes("--apply");
const OUT = path.join(process.cwd(), "reports/rulings-research/04-segments.data.json");
const BATCH = 200;

function tally() {
  return { rulings: 0, rows: 0, byPart: {} as Record<string, number>, indexedChars: 0, written: 0, skipped: 0 };
}

async function* rulings(q: QueryFn) {
  let last = "";
  for (;;) {
    const rows = await q<{ id: string; text: string | null }>(
      `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last);
    if (!rows.length) return;
    yield rows;
    last = rows[rows.length - 1].id;
  }
}

function write(data: Record<string, unknown>) {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), mode: APPLY ? "apply" : "dry-run", segmentVersion: SEGMENT_EXTRACTOR_VERSION, ...data }, null, 2) + "\n");
  console.log(JSON.stringify(data));
}

function count(t: ReturnType<typeof tally>, rows: SegmentRow[]) {
  t.rulings++;
  for (const r of rows) {
    t.rows++;
    t.byPart[r.part] = (t.byPart[r.part] ?? 0) + 1;
    t.indexedChars += r.part_norm?.length ?? 0;
  }
}

async function dryRun() {
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const t = tally();
    for await (const batch of rulings(db.q)) for (const r of batch) count(t, segmentRows(r.id, r.text ?? ""));
    write(t);
  } finally {
    await db.close();
  }
}

const COLS = ["ruling_id", "part", "start_char", "end_char", "confidence", "part_norm", "content_hash", "segment_version"] as const;

async function apply() {
  const target = resolveWriteTarget();
  console.log(`✍️ الهدف: ${target.kind}${target.approval ? ` — موافقة المالك: ${target.approval}` : ""}`);
  const prisma = new PrismaClient({ datasources: { db: { url: target.url } }, log: ["error"] });
  const q: QueryFn = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);
  const t = tally();
  try {
    await applyMigration(prisma, META_SEGMENTS_MIGRATION);
    for await (const batch of rulings(q)) {
      const have = new Map((await q<{ ruling_id: string; content_hash: string; segment_version: string }>(
        `SELECT DISTINCT ruling_id, content_hash, segment_version FROM ruling_segments WHERE ruling_id = ANY($1::text[])`,
        batch.map((r) => r.id))).map((h) => [h.ruling_id, `${h.content_hash}|${h.segment_version}`]));
      const fresh: SegmentRow[] = [];
      const changed: string[] = [];
      for (const r of batch) {
        const rows = segmentRows(r.id, r.text ?? "");
        count(t, rows);
        const key = rows[0] ? `${rows[0].content_hash}|${rows[0].segment_version}` : null;
        // صفوف أكملها النموذج (segment_version = «<قواعد>+<نموذج>») لا تُستبدل بالقواعد وحدها ما دام النص لم يتغير.
        const stored = have.get(r.id);
        const modelKept = Boolean(key && stored && stored.startsWith(`${rows[0].content_hash}|${rows[0].segment_version}+`));
        if (key && (stored === key || modelKept)) {
          t.skipped++;
          continue;
        }
        if (have.has(r.id)) changed.push(r.id);
        fresh.push(...rows);
      }
      if (changed.length) await prisma.$executeRawUnsafe(`DELETE FROM ruling_segments WHERE ruling_id = ANY($1::text[])`, changed);
      if (fresh.length) {
        const params: unknown[] = [];
        const tuples = fresh.map((row) => `(${COLS.map((c) => { params.push(row[c]); return `$${params.length}`; }).join(",")})`);
        await prisma.$executeRawUnsafe(
          `INSERT INTO ruling_segments (${COLS.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")}
           ON CONFLICT (ruling_id, part) DO UPDATE SET ${COLS.filter((c) => c !== "ruling_id" && c !== "part").map((c) => `"${c}"=EXCLUDED."${c}"`).join(",")},
             review_status='needs_review', created_at=now()`, ...params);
        t.written += fresh.length;
      }
      process.stdout.write(`\r… ${t.rulings} — كُتب ${t.written}`);
    }
    process.stdout.write("\n");
    write({ ...t, target: target.kind });
  } finally {
    await prisma.$disconnect();
  }
}

(APPLY ? apply() : dryRun()).catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
