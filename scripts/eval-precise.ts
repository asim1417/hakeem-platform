/**
 * eval-precise.ts — HKM-062 (مراجعة الجودة على #984، B1): هل يتراجع السؤال النظامي الدقيق في hakeem_search؟
 *
 * جسر لغة الناس يمر بكل سؤال إلى hakeem_search، والمجموعات القائمة (eval-search، eval-known-item) لا تمر بمسارها
 * (searchArticles). فهنا مجموعتان عبر searchArticles نفسها:
 *   • الألفاظ الدقيقة (data/eval/precise-queries.json): لكل سؤال لفظ نظامي معناه غير معناه الدارج («الخصم»، «الصلح»،
 *     «عقد صوري»). المرجع أعلى ثلاث نتائج للإنتاج (main) في baseline.terms؛ «تراجع» = أولى main خارج ثلاث هذا الإعداد.
 *   • عيّنة eval-known-item نفسها (scripts/known-item-sample.ts) بهدفها الذهبي: hit@1/3/10 وMRR، و«تراجع» = هدف كان في
 *     ثلاث main (baseline.known_item) وخرج منها.
 * قراءة فقط: استعلامات SELECT ونداء تضمين للسؤال.
 *
 * التشغيل:  npm run eval:precise              (تقرير)
 *           npm run eval:precise -- --gate      (يفشل إن تراجع سؤال عن baseline)
 *           EVAL_PRECISE_DUMP=1                  (يطبع أعلى ثلاث لكل سؤال لبناء baseline من main)
 *           متغيرات: EVAL_PRECISE=path  KI_SAMPLE=120  KI_MIN_TITLE=10  EVAL_EVERYDAY_VARIANTS  EVAL_EVERYDAY_CONCURRENCY
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as adapter from "@/lib/mcp/adapter";
import { prisma } from "@/lib/prisma";
import { loadUsableKnownItems, strideSample } from "./known-item-sample";

type Term = { id: string; query: string; law_id?: string; note?: string };
type Baseline = { ref?: string; sha?: string; at?: string; terms?: Record<string, string[]>; known_item?: Record<string, number | null> };
type Fixture = { version: number; terms: Term[]; baseline?: Baseline };
type Variant = { name: string; opts?: Record<string, unknown> };
type Row = { article_id: string; law: string; law_id: string | null; article_number: number };
type SearchFn = (q: string, lawId?: string, limit?: number, opts?: Record<string, unknown>) => Promise<{ results: Row[] }>;

const LIMIT = 10;
const GATE_MODE = process.argv.includes("--gate");
const DUMP = process.env.EVAL_PRECISE_DUMP === "1";
const search = adapter.searchArticles as unknown as SearchFn;

function loadFixture(): Fixture {
  const p = resolve(process.cwd(), process.env.EVAL_PRECISE || "data/eval/precise-queries.json");
  return JSON.parse(readFileSync(p, "utf8")) as Fixture;
}

function variants(): Variant[] {
  const raw = process.env.EVAL_EVERYDAY_VARIANTS;
  if (!raw) return [{ name: "default" }];
  const v = JSON.parse(raw) as Variant[];
  return Array.isArray(v) && v.length ? v : [{ name: "default" }];
}

async function runSearch(q: string, lawId: string | undefined, opts: Record<string, unknown> | undefined) {
  const t0 = Date.now();
  try {
    const r = await search(q, lawId, LIMIT, opts ?? {});
    return { rows: r.results ?? [], ms: Date.now() - t0, error: null as string | null };
  } catch (e) {
    return { rows: [] as Row[], ms: Date.now() - t0, error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 160) : "unknown" };
  }
}

const short = (law: string) => law.replace(/^(نظام|اللائحة التنفيذية لنظام|لائحة|تنظيم)\s+/, "").slice(0, 16);
const refs = (rows: Row[]) => rows.slice(0, 3).map((r) => `${short(r.law)}${r.article_number}`).join("،");

function annotate(kind: "notice" | "warning", title: string, body: string) {
  const enc = body.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  console.log(`::${kind} title=${title}::${enc}`);
}

function chunks(lines: string[], max = 1400): string[] {
  const out: string[] = [];
  let cur = "";
  for (const l of lines) {
    if (cur.length + l.length + 1 > max && cur) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + l;
  }
  if (cur) out.push(cur);
  return out;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
    }),
  );
  return out;
}

async function main() {
  const fx = loadFixture();
  const base = fx.baseline ?? {};
  const sampleSize = Number(process.env.KI_SAMPLE || 120);
  const minTitle = Number(process.env.KI_MIN_TITLE || 10);
  const CONCURRENCY = Math.min(Math.max(Number(process.env.EVAL_EVERYDAY_CONCURRENCY) || 1, 1), 4);
  const { sample } = strideSample(await loadUsableKnownItems(minTitle), sampleSize);
  console.log(`terms=${fx.terms.length} known_item=${sample.length} baseline=${base.ref ?? "—"}@${base.sha ?? "—"}`);

  const report: Record<string, unknown> = { fixture_version: fx.version, baseline: { ref: base.ref, sha: base.sha }, variants: [] as unknown[] };
  let gateFailed = false;
  let warnings = 0;
  const warn = (title: string, lines: string[]) => {
    for (const [i, c] of chunks(lines).entries()) {
      if (warnings >= 10) return;
      annotate("warning", `${title} ${i + 1}`, c);
      warnings++;
    }
  };

  for (const v of variants()) {
    const terms = await pool(fx.terms, CONCURRENCY, async (t) => ({ t, ...(await runSearch(t.query, t.law_id, v.opts)) }));
    const ki = await pool(sample, CONCURRENCY, async (k) => {
      const r = await runSearch(k.q, undefined, v.opts);
      const i = r.rows.findIndex((x) => x.article_id === k.a.id);
      return { id: k.a.id, q: k.q, rank: r.error ? null : i >= 0 ? i + 1 : null, ms: r.ms, error: r.error, rows: r.rows };
    });

    // ── العيّنة المعروفة: الهدف الذهبي ──
    const ok = ki.filter((p) => !p.error);
    const n = ok.length || 1;
    const hitAt = (k: number) => +(ok.filter((p) => p.rank !== null && p.rank <= k).length / n).toFixed(3);
    const kiSum = { n: ok.length, errors: ki.length - ok.length, hit1: hitAt(1), hit3: hitAt(3), hit10: hitAt(10), mrr: +(ok.reduce((s, p) => s + (p.rank ? 1 / p.rank : 0), 0) / n).toFixed(3) };
    const kiBase = base.known_item ?? {};
    const kiCompared = ok.filter((p) => p.id in kiBase);
    const kiDrops = kiCompared.filter((p) => (kiBase[p.id] ?? 99) <= 3 && (p.rank ?? 99) > 3);
    const kiGains = kiCompared.filter((p) => (kiBase[p.id] ?? 99) > 3 && (p.rank ?? 99) <= 3);
    const kiBaseHit3 = kiCompared.length ? +(kiCompared.filter((p) => (kiBase[p.id] ?? 99) <= 3).length / kiCompared.length).toFixed(3) : null;

    // ── الألفاظ الدقيقة: أولى main في ثلاث الإعداد ──
    const tBase = base.terms ?? {};
    const tCompared = terms.filter((x) => !x.error && tBase[x.t.id]?.length);
    const kept = tCompared.filter((x) => x.rows.slice(0, 3).some((r) => r.article_id === tBase[x.t.id][0]));
    const tDrops = tCompared.filter((x) => !kept.includes(x));
    const overlap = tCompared.length
      ? +(tCompared.reduce((s, x) => s + x.rows.slice(0, 3).filter((r) => tBase[x.t.id].slice(0, 3).includes(r.article_id)).length / Math.min(3, tBase[x.t.id].length), 0) / tCompared.length).toFixed(3)
      : null;
    const tErrors = terms.filter((x) => x.error).length;
    const ms = [...terms.map((x) => x.ms), ...ki.map((x) => x.ms)].sort((a, b) => a - b);
    const p50 = ms[Math.floor(ms.length / 2)] ?? 0;
    const p95 = ms[Math.min(ms.length - 1, Math.floor(ms.length * 0.95))] ?? 0;
    if (tDrops.length || kiDrops.length || tErrors || kiSum.errors) gateFailed = true;

    const head = [
      `variant=${v.name} p50=${p50} p95=${p95}`,
      `known_item n=${kiSum.n} hit1=${kiSum.hit1} hit3=${kiSum.hit3} hit10=${kiSum.hit10} mrr=${kiSum.mrr} errors=${kiSum.errors}`,
      `known_item vs baseline: compared=${kiCompared.length} base_hit3=${kiBaseHit3 ?? "—"} drop3=${kiDrops.length} gain3=${kiGains.length}`,
      `terms n=${terms.length} errors=${tErrors} vs baseline: compared=${tCompared.length} main_top1_in_top3=${kept.length}/${tCompared.length} top3_overlap=${overlap ?? "—"}`,
    ].join("\n");
    console.log(`\n══ ${head}`);
    for (const x of terms) console.log(`  ${x.t.id}  [${refs(x.rows)}]${x.error ? ` ERROR ${x.error}` : ""}`);
    annotate("notice", `precise ${v.name} summary`, head);

    if (DUMP) {
      // أعلى ثلاث بالمعرّف لكل لفظ، ورتبة الهدف لكل مادة في العيّنة: يُنسخ إلى baseline في الملف.
      warn(`precise ${v.name} dump-terms`, terms.map((x) => `T:${x.t.id}=${x.rows.slice(0, 3).map((r) => r.article_id).join(",")}`));
      warn(`precise ${v.name} dump-ki`, ki.map((p) => `K:${p.id}=${p.error ? "E" : (p.rank ?? "-")}`));
    }
    const changed = [
      ...tDrops.map((x) => `DROP ${x.t.id} main1=${tBase[x.t.id][0]} now=[${refs(x.rows)}]`),
      ...kiDrops.map((p) => `DROP ki ${p.id} ${kiBase[p.id]}→${p.rank ?? "-"} «${p.q.slice(0, 40)}» [${refs(p.rows)}]`),
      ...kiGains.map((p) => `gain ki ${p.id} ${kiBase[p.id] ?? "-"}→${p.rank} «${p.q.slice(0, 30)}»`),
      ...terms.filter((x) => !tDrops.includes(x)).map((x) => `${x.t.id} [${refs(x.rows)}]`),
    ];
    if (!DUMP) warn(`precise ${v.name} changes`, changed);

    (report.variants as unknown[]).push({ name: v.name, opts: v.opts ?? {}, known_item: kiSum, kiDrops: kiDrops.map((p) => p.id), terms: terms.map((x) => ({ id: x.t.id, top3: x.rows.slice(0, 3).map((r) => r.article_id) })), termDrops: tDrops.map((x) => x.t.id) });
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### precise — ${v.name}\n\n\`\`\`\n${head}\n\`\`\`\n\n${changed.map((l) => `- ${l}`).join("\n")}\n\n`);
  }
  if (process.env.EVAL_PRECISE_OUT) writeFileSync(process.env.EVAL_PRECISE_OUT, JSON.stringify(report, null, 2));
  await prisma.$disconnect().catch(() => undefined);
  if (GATE_MODE && gateFailed) {
    console.error("::error::تراجع سؤال دقيق أو أكثر عن baseline (انظر السجل).");
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("eval-precise failed:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
