/**
 * 02-segment-dryrun — المرحلة الثانية: تشغيل جافّ للتقطيع بالقواعد على كل الأحكام (قراءة فقط).
 *
 * لا يكتب في القاعدة ولا يُخرج نصوصًا: أعداد ونسب فقط (المستودع عام).
 *   • نسبة العثور على كل حدّ (الدعوى، الإجابة، الأسباب، المنطوق، ما بعد المنطوق، الختام).
 *   • نسبة الأحكام المقطّعة بالقواعد وحدها (claims + reasons + disposition) — وما عداها يحتاج النموذج.
 *   • الشرط الهيكلي (تغطية متجاورة ومرتبة)، ونصيب كل جزء من طول النص (الوسيط)،
 *     وتوزيع موضع بداية المنطوق، وكل ذلك بحسب نوع المحكمة.
 * دقة الحدود (بوابة ≥ ٩٥٪) لا تُقاس هنا: تحتاج العيّنة الذهبية المرمّزة يدويًّا (المرحلة السادسة).
 *
 * المخرج: reports/rulings-research/02-segment.data.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { checkStructure, segmentRuling, SEGMENT_EXTRACTOR_VERSION, type SegmentType } from "../../lib/rulings/research/segment";
import { classifyCourt } from "../../lib/rulings/research/meta";

const OUT = path.join(process.cwd(), "reports/rulings-research/02-segment.data.json");
const BATCH = 1000;
const TYPES: SegmentType[] = ["header", "claims", "defense", "reasons", "disposition", "appeal", "other"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 10000) / 100 : 0);
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null);

interface Bucket {
  rows: number; ruleOnly: number; contiguous: number; ordered: number;
  found: Record<string, number>; share: Record<string, number[]>; dispositionAt: number[];
}
const bucket = (): Bucket => ({ rows: 0, ruleOnly: 0, contiguous: 0, ordered: 0, found: {}, share: {}, dispositionAt: [] });

function add(b: Bucket, text: string, permanentPanel: boolean) {
  const seg = segmentRuling(text, { permanentPanel });
  const st = checkStructure(seg, text.length);
  b.rows++;
  if (!seg.needsModel) b.ruleOnly++;
  if (st.contiguous) b.contiguous++;
  if (st.ordered) b.ordered++;
  for (const [t, ok] of Object.entries(seg.found)) if (ok) b.found[t] = (b.found[t] ?? 0) + 1;
  for (const s of seg.segments) (b.share[s.type] ??= []).push(Math.round(((s.end - s.start) / Math.max(1, text.length)) * 1000) / 1000);
  const d = seg.segments.find((s) => s.type === "disposition");
  if (d) b.dispositionAt.push(Math.round((d.start / Math.max(1, text.length)) * 100) / 100);
}

function summarize(b: Bucket) {
  const deciles = Array.from({ length: 10 }, (_, i) => b.dispositionAt.filter((x) => x >= i / 10 && x < (i + 1) / 10 + (i === 9 ? 0.01 : 0)).length);
  return {
    rows: b.rows,
    ruleOnly: { n: b.ruleOnly, pct: pct(b.ruleOnly, b.rows) },
    needsModel: { n: b.rows - b.ruleOnly, pct: pct(b.rows - b.ruleOnly, b.rows) },
    structure: { contiguousPct: pct(b.contiguous, b.rows), orderedPct: pct(b.ordered, b.rows) },
    foundPct: Object.fromEntries(TYPES.filter((t) => t !== "header").map((t) => [t, pct(b.found[t] ?? 0, b.rows)])),
    medianShareOfText: Object.fromEntries(TYPES.map((t) => [t, median(b.share[t] ?? [])])),
    dispositionStartDeciles: deciles,
  };
}

async function main() {
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const all = bucket();
    const byCourt = new Map<string, Bucket>();
    let last = "";
    for (;;) {
      const rows = await db.q<{ id: string; court: string | null; text: string }>(
        `SELECT id, court, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT ${BATCH}`, last);
      if (!rows.length) break;
      for (const r of rows) {
        const k = classifyCourt(r.court) ?? "∅";
        add(all, r.text, k === "أخرى");
        if (!byCourt.has(k)) byCourt.set(k, bucket());
        add(byCourt.get(k)!, r.text, k === "أخرى");
      }
      last = rows[rows.length - 1].id;
      process.stdout.write(`\r… ${all.rows}`);
    }
    process.stdout.write("\n");
    const data = {
      measuredAt: new Date().toISOString(),
      extractorVersion: SEGMENT_EXTRACTOR_VERSION,
      mode: "dry-run",
      all: summarize(all),
      byCourtType: Object.fromEntries([...byCourt.entries()].map(([k, b]) => [k, summarize(b)])),
      note: "دقة الحدود تُقاس على العيّنة الذهبية (المرحلة السادسة)؛ هذه أعداد تغطية وبنية فقط.",
    };
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(data, null, 2));
    console.log(`✓ ${path.relative(process.cwd(), OUT)} — بالقواعد وحدها ${data.all.ruleOnly.pct}%`);
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
