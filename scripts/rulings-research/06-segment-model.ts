/**
 * 06-segment-model — إكمال حدود التقطيع بالنموذج: عدّ الرموز ثم عيّنة صغيرة، **بلا أي كتابة في القاعدة**.
 *
 *   --count N   يعدّ رموز N منطقة حدّ بنقطة count_tokens (لا توليد)، ويُسقط الكلفة على الكل بالعدد الحقيقي.
 *   --sample N  يرسل N منطقة إلى النموذج (Messages API)، ويتحقق من كل اقتباس في النص الأصلي، ويقيس:
 *               نسبة الحدود الموجودة والمتحقَّقة وأسباب الرفض والرموز والكلفة. MAX_MODEL_CALLS إلزامي.
 *   --apply     للإنتاج أو الفرع البحثي (أقفال write-target + MAX_MODEL_CALLS): يسأل النموذج عن كل منطقة،
 *               ويُدخل الحدّ المتحقَّق منه حرفيًّا في الأجزاء، فيكتب ruling_segments لذلك الحكم (method='model'
 *               للجزء المضاف، needs_review) ومتجهات أسبابه ومنطوقه. judicial_cases لا يُمسّ.
 * ما يُرسل: منطقة الحدّ وحدها (05-segment-model-dryrun)، محجوبة (maskPersonalData). القراءة للقراءة فقط.
 * المخرج أعداد فقط (المستودع عام): reports/rulings-research/06-segment-model.data.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { boundaryRegions, type Missing } from "../../lib/rulings/research/segment-store";
import {
  applyModelBoundary, parseAnswer, regionInput, SEGMENT_MODEL, SEGMENT_MODEL_VERSION, SYSTEM_PROMPT, userPrompt, verifyQuote,
  type PlainSegment,
} from "../../lib/rulings/research/segment-model";
import { PrismaClient } from "@prisma/client";
import { segmentRuling, SEGMENT_EXTRACTOR_VERSION } from "../../lib/rulings/research/segment";
import { contentHash } from "../../lib/rulings/research/meta";
import { applyMigration, META_SEGMENTS_MIGRATION, resolveWriteTarget } from "../../lib/rulings/research/write-target";
import { buildRulingSearchNorm } from "../../lib/modules/legal-core/rulings-search";
import { maskPersonalData } from "../../lib/rulings/research/mask";
import { buildSegmentChunks, segmentContentHash, SEGMENT_EMBED_VERSION } from "../../lib/rulings/research/segment-embeddings";
import { EMBEDDING_DIMS, EMBEDDING_MODEL, embedBatch } from "../../lib/modules/ai/embeddings";

const OUT = path.join(process.cwd(), "reports/rulings-research/06-segment-model.data.json");
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : null;
};
const COUNT = arg("--count");
const SAMPLE = arg("--sample");
const APPLY = process.argv.includes("--apply");
type Verdict = { ok: true; at: number } | { ok: false; reason: "not_found" | "too_short" | "masked" | "unparsed" | "not_present" | "error" };
type Usage = { in: number; out: number };

/** يسأل النموذج عن بداية الجزء المفقود في منطقته، ويتحقق من الاقتباس حرفيًّا في النص الأصلي. */
async function askModel(text: string, g: { missing: Missing; start: number; end: number }, usage: Usage): Promise<Verdict> {
  const { input } = regionInput(text, g.start, g.end);
  let res: { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } };
  try {
    res = await post("/messages", {
      model: SEGMENT_MODEL, max_tokens: 1024, output_config: { effort: "low" },
      system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt(g.missing, input) }],
    });
  } catch {
    return { ok: false, reason: "error" };
  }
  usage.in += res.usage.input_tokens;
  usage.out += res.usage.output_tokens;
  const ans = parseAnswer(res.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
  if (!ans) return { ok: false, reason: "unparsed" };
  if (!ans.found || !ans.quote) return { ok: false, reason: "not_present" };
  return verifyQuote(text, g.start, g.end, ans.quote);
}
// $/مليون رمز من مرجع Claude API (2026-10-06)؛ Batch بنصف السعر.
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-haiku-5-5": { in: 0.1, out: 0.5 }, "claude-haiku-4-5": { in: 1.0, out: 5.0 }, "claude-sonnet-5-5": { in: 2.0, out: 10.0 },
};
const API = "https://api.anthropic.com/v1";

function key(): string {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) {
    console.error("🛑 لا يوجد ANTHROPIC_API_KEY.");
    process.exit(2);
  }
  return k;
}

async function post<T>(p: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${API}${p}`, {
      method: "POST",
      headers: { "x-api-key": key(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return (await r.json()) as T;
    if ((r.status === 429 || r.status >= 500) && attempt < 4) {
      await new Promise((res) => setTimeout(res, 2000 * 2 ** attempt));
      continue;
    }
    // نوع الخطأ ورسالته من واجهة Anthropic (لا تتضمن نص الطلب)، مقصوصة احتياطًا.
    const err = (await r.json().catch(() => null)) as { error?: { type?: string; message?: string } } | null;
    throw new Error(`HTTP ${r.status} ${err?.error?.type ?? ""}: ${(err?.error?.message ?? "").slice(0, 160)}`);
  }
}

interface Region { id: string; missing: Missing; start: number; end: number }

/** كل مناطق الحدود المفقودة، ثم عيّنة متساوية التباعد بترتيب المعرّف. */
async function collect(q: ReturnType<typeof openReadOnlyDb>["q"]) {
  const all: Region[] = [];
  const chars: Record<Missing, number> = { claims: 0, reasons: 0, disposition: 0 };
  let last = "";
  for (;;) {
    const rows = await q<{ id: string; text: string | null }>(
      `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT 500`, last);
    if (!rows.length) break;
    for (const r of rows) {
      const text = r.text ?? "";
      for (const g of boundaryRegions(text)) {
        all.push({ id: r.id, ...g });
        chars[g.missing] += regionInput(text, g.start, g.end).input.length;
      }
    }
    last = rows[rows.length - 1].id;
    process.stdout.write(`\r… ${all.length} منطقة`);
  }
  process.stdout.write("\n");
  return { all, chars };
}

function pick<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  const step = xs.length / n;
  return Array.from({ length: n }, (_, i) => xs[Math.floor(i * step)]);
}

async function texts(q: ReturnType<typeof openReadOnlyDb>["q"], ids: string[]) {
  const rows = await q<{ id: string; text: string | null }>(
    `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id = ANY($1::text[])`, ids);
  return new Map(rows.map((r) => [r.id, r.text ?? ""]));
}

function write(data: Record<string, unknown>) {
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), model: SEGMENT_MODEL, version: SEGMENT_MODEL_VERSION, ...data }, null, 2) + "\n");
  console.log(JSON.stringify(data));
}

async function main() {
  if (!COUNT && !SAMPLE) {
    console.error("استعمل --count N أو --sample N");
    process.exit(2);
  }
  if (SAMPLE) {
    const cap = Number(process.env.MAX_MODEL_CALLS);
    if (!Number.isFinite(cap) || cap < SAMPLE) {
      console.error("🛑 MAX_MODEL_CALLS إلزامي ولا يقل عن حجم العيّنة.");
      process.exit(2);
    }
  }
  const db = openReadOnlyDb();
  try {
    console.log(`🔒 قراءة فقط: ${await assertReadOnly(db)} — النقل: ${db.transport}`);
    const { all, chars } = await collect(db.q);
    const totalChars = chars.claims + chars.reasons + chars.disposition;
    const sample = pick(all, (COUNT ?? SAMPLE)!);
    const byId = await texts(db.q, [...new Set(sample.map((s) => s.id))]);

    if (COUNT) {
      let tok = 0, ch = 0;
      for (const g of sample) {
        const { input } = regionInput(byId.get(g.id)!, g.start, g.end);
        const r = await post<{ input_tokens: number }>("/messages/count_tokens", {
          model: SEGMENT_MODEL, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt(g.missing, input) }],
        });
        tok += r.input_tokens;
        ch += input.length;
      }
      const perRegionOverhead = 0; // مضمّن في العدّ (التعليمات تُعدّ مع كل منطقة)
      const tokensPerChar = tok / Math.max(1, ch);
      const projectedIn = Math.round(totalChars * tokensPerChar + perRegionOverhead);
      const projectedOut = all.length * 80;
      const usd = Object.fromEntries(Object.entries(PRICE).map(([m, p]) => {
        const full = (projectedIn / 1e6) * p.in + (projectedOut / 1e6) * p.out;
        return [m, { standard: Math.round(full * 100) / 100, batch: Math.round(full * 50) / 100 }];
      }));
      write({ mode: "count", regions: all.length, sampled: sample.length, sampleTokens: tok, sampleChars: ch,
        charsPerToken: Math.round((ch / Math.max(1, tok)) * 100) / 100, projectedInputTokens: projectedIn, projectedOutputTokens: projectedOut, usd });
      return;
    }

    const t = { calls: 0, found: 0, verified: 0, rejected: { not_found: 0, too_short: 0, masked: 0, unparsed: 0, not_present: 0 },
      byPart: {} as Record<string, { n: number; verified: number }>, inTokens: 0, outTokens: 0, errors: 0 };
    for (const g of sample) {
      const text = byId.get(g.id)!;
      const { input } = regionInput(text, g.start, g.end);
      t.calls++;
      const bp = (t.byPart[g.missing] ??= { n: 0, verified: 0 });
      bp.n++;
      let res: { content: Array<{ type: string; text?: string }>; usage: { input_tokens: number; output_tokens: number } };
      try {
        res = await post("/messages", {
          model: SEGMENT_MODEL, max_tokens: 1024, output_config: { effort: "low" },
          system: SYSTEM_PROMPT, messages: [{ role: "user", content: userPrompt(g.missing, input) }],
        });
      } catch {
        t.errors++;
        continue;
      }
      t.inTokens += res.usage.input_tokens;
      t.outTokens += res.usage.output_tokens;
      const ans = parseAnswer(res.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"));
      if (!ans) {
        t.rejected.unparsed++;
        continue;
      }
      if (!ans.found || !ans.quote) {
        t.rejected.not_present++;
        continue;
      }
      t.found++;
      const v = verifyQuote(text, g.start, g.end, ans.quote);
      if (v.ok) {
        t.verified++;
        bp.verified++;
      } else t.rejected[v.reason]++;
    }
    const p = PRICE[SEGMENT_MODEL] ?? PRICE["claude-haiku-5-5"];
    const sampleUsd = (t.inTokens / 1e6) * p.in + (t.outTokens / 1e6) * p.out;
    const projectedBatchUsd = (sampleUsd / Math.max(1, t.calls)) * all.length * 0.5;
    write({ mode: "sample", regions: all.length, ...t,
      verifiedPct: Math.round((t.verified / Math.max(1, t.calls)) * 10000) / 100,
      sampleUsd: Math.round(sampleUsd * 10000) / 10000, projectedBatchUsdAll: Math.round(projectedBatchUsd * 100) / 100 });
  } finally {
    await db.close();
  }
}

const MODEL_SEGMENT_VERSION = `${SEGMENT_EXTRACTOR_VERSION}+${SEGMENT_MODEL_VERSION}`;
const SEG_COLS = ["ruling_id", "part", "start_char", "end_char", "method", "confidence", "part_norm", "content_hash", "segment_version"] as const;

async function apply() {
  const target = resolveWriteTarget();
  const cap = Number(process.env.MAX_MODEL_CALLS);
  if (!Number.isFinite(cap) || cap <= 0) {
    console.error("🛑 MAX_MODEL_CALLS إلزامي.");
    process.exit(2);
  }
  console.log(`✍️ الهدف: ${target.kind}${target.approval ? ` — موافقة المالك: ${target.approval}` : ""} — سقف النداءات: ${cap}`);
  const db = new PrismaClient({ datasources: { db: { url: target.url } }, log: ["error"] });
  const usage: Usage = { in: 0, out: 0 };
  const t = { rulings: 0, regions: 0, calls: 0, verified: 0, applied: 0, orderRejected: 0, segmentRows: 0, embedded: 0, embedFailed: 0,
    rejected: { not_found: 0, too_short: 0, masked: 0, unparsed: 0, not_present: 0, error: 0 } as Record<string, number>,
    byPart: {} as Record<string, { n: number; applied: number }>, stoppedAtCap: false };
  try {
    await applyMigration(db, META_SEGMENTS_MIGRATION);
    let last = "";
    outer: for (;;) {
      const rows = await db.$queryRawUnsafe<Array<{ id: string; text: string | null }>>(
        `SELECT id, "judgmentText" AS text FROM judicial_cases WHERE id > $1 ORDER BY id LIMIT 200`, last);
      if (!rows.length) break;
      last = rows[rows.length - 1].id;
      for (const r of rows) {
        const text = r.text ?? "";
        const regions = boundaryRegions(text);
        if (!regions.length) continue;
        t.rulings++;
        let segs: PlainSegment[] = segmentRuling(text).segments.map((x) => ({ type: x.type, start: x.start, end: x.end }));
        const added = new Set<string>();
        for (const g of regions) {
          if (t.calls >= cap) {
            t.stoppedAtCap = true;
            break outer;
          }
          t.regions++;
          t.calls++;
          const bp = (t.byPart[g.missing] ??= { n: 0, applied: 0 });
          bp.n++;
          const v = await askModel(text, g, usage);
          if (!v.ok) {
            t.rejected[v.reason]++;
            continue;
          }
          t.verified++;
          const next = applyModelBoundary(segs, g.missing, v.at);
          if (!next) {
            t.orderRejected++;
            continue;
          }
          segs = next;
          added.add(g.missing);
          bp.applied++;
        }
        if (!added.size) continue;
        t.applied++;
        // أجزاء الحكم كاملة: القواعد + حدّ النموذج (method='model'، ثقة 0.7، needs_review).
        const hash = contentHash(text);
        const params: unknown[] = [];
        const tuples = segs.map((x) => {
          const vals = [r.id, x.type, x.start, x.end, added.has(x.type) ? "model" : "rule", added.has(x.type) ? 0.7 : 0.8,
            x.type === "reasons" || x.type === "disposition" ? buildRulingSearchNorm(null, text.slice(x.start, x.end)) : null,
            hash, MODEL_SEGMENT_VERSION];
          return `(${vals.map((v) => { params.push(v); return `$${params.length}`; }).join(",")})`;
        });
        await db.$executeRawUnsafe(`DELETE FROM ruling_segments WHERE ruling_id = $1`, r.id);
        await db.$executeRawUnsafe(
          `INSERT INTO ruling_segments (${SEG_COLS.map((c) => `"${c}"`).join(",")}) VALUES ${tuples.join(",")}`, ...params);
        t.segmentRows += segs.length;
        // متجهات الأسباب والمنطوق من الأجزاء الجديدة (البصمة تمنع إعادة غير المتغير).
        const chunks = buildSegmentChunks(text, maskPersonalData, segs);
        const have = new Map((await db.$queryRawUnsafe<Array<{ part: string; chunk: number; content_hash: string }>>(
          `SELECT part, chunk, content_hash FROM ruling_segment_embeddings WHERE ruling_id = $1`, r.id)).map((e) => [`${e.part}|${e.chunk}`, e.content_hash]));
        const todo = chunks.filter((c) => have.get(`${c.part}|${c.chunk}`) !== segmentContentHash(c.input, EMBEDDING_MODEL));
        const keep = new Set(chunks.map((c) => `${c.part}|${c.chunk}`));
        for (const k of have.keys()) if (!keep.has(k)) {
          const [part, chunk] = k.split("|");
          await db.$executeRawUnsafe(`DELETE FROM ruling_segment_embeddings WHERE ruling_id=$1 AND part=$2 AND chunk=$3`, r.id, part, Number(chunk));
        }
        if (todo.length) {
          const vecs = await embedBatch(todo.map((c) => c.input));
          for (let i = 0; i < todo.length; i++) {
            const v = vecs[i];
            const c = todo[i];
            if (!v || v.length !== EMBEDDING_DIMS) {
              t.embedFailed++;
              continue;
            }
            await db.$executeRawUnsafe(
              `INSERT INTO ruling_segment_embeddings
                 (ruling_id, part, chunk, start_char, end_char, content_hash, embedding, model, extractor_version, segment_version)
               VALUES ($1,$2,$3,$4,$5,$6,$7::vector,$8,$9,$10)
               ON CONFLICT (ruling_id, part, chunk) DO UPDATE SET start_char=EXCLUDED.start_char, end_char=EXCLUDED.end_char,
                 content_hash=EXCLUDED.content_hash, embedding=EXCLUDED.embedding, model=EXCLUDED.model,
                 extractor_version=EXCLUDED.extractor_version, segment_version=EXCLUDED.segment_version,
                 review_status='needs_review', created_at=now()`,
              r.id, c.part, c.chunk, c.start, c.end, segmentContentHash(c.input, EMBEDDING_MODEL), `[${v.join(",")}]`,
              EMBEDDING_MODEL, SEGMENT_EMBED_VERSION, MODEL_SEGMENT_VERSION);
            t.embedded++;
          }
        }
      }
      process.stdout.write(`\r… أحكام ${t.rulings} — نداءات ${t.calls} — طُبّق ${t.applied}`);
    }
    process.stdout.write("\n");
    const p = PRICE[SEGMENT_MODEL] ?? PRICE["claude-haiku-5-5"];
    const usd = (usage.in / 1e6) * p.in + (usage.out / 1e6) * p.out;
    write({ mode: "apply", target: target.kind, segmentVersion: MODEL_SEGMENT_VERSION, ...t, inTokens: usage.in, outTokens: usage.out,
      usd: Math.round(usd * 1000) / 1000 });
  } finally {
    await db.$disconnect();
  }
}

(APPLY ? apply() : main()).catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
