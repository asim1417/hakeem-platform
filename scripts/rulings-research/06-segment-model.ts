/**
 * 06-segment-model — إكمال حدود التقطيع بالنموذج: عدّ الرموز ثم عيّنة صغيرة، **بلا أي كتابة في القاعدة**.
 *
 *   --count N   يعدّ رموز N منطقة حدّ بنقطة count_tokens (لا توليد)، ويُسقط الكلفة على الكل بالعدد الحقيقي.
 *   --sample N  يرسل N منطقة إلى النموذج (Messages API)، ويتحقق من كل اقتباس في النص الأصلي، ويقيس:
 *               نسبة الحدود الموجودة والمتحقَّقة وأسباب الرفض والرموز والكلفة. MAX_MODEL_CALLS إلزامي.
 * ما يُرسل: منطقة الحدّ وحدها (05-segment-model-dryrun)، محجوبة (maskPersonalData). القراءة للقراءة فقط.
 * المخرج أعداد فقط (المستودع عام): reports/rulings-research/06-segment-model.data.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { assertReadOnly, openReadOnlyDb } from "../../lib/rulings/audit/readonly-db";
import { boundaryRegions, type Missing } from "../../lib/rulings/research/segment-store";
import {
  parseAnswer, regionInput, SEGMENT_MODEL, SEGMENT_MODEL_VERSION, SYSTEM_PROMPT, userPrompt, verifyQuote,
} from "../../lib/rulings/research/segment-model";

const OUT = path.join(process.cwd(), "reports/rulings-research/06-segment-model.data.json");
const arg = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? Number(process.argv[i + 1]) : null;
};
const COUNT = arg("--count");
const SAMPLE = arg("--sample");
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

main().catch((e) => {
  console.error("فشل:", (e as Error).message);
  process.exitCode = 1;
});
