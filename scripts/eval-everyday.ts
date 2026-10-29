/**
 * eval-everyday.ts — HKM-062: مقياس hakeem_search على أسئلة الناس (data/eval/everyday-queries.json).
 *
 * يمر بالمسار نفسه الذي تستعمله أداة hakeem_search في الموصل: searchArticles من lib/mcp/adapter.ts
 * (الدمج اللفظي + الدلالي ثم تكملة المحرك الهجين)، لا بالنواة searchLegalCore التي تقيسها eval-search.
 *
 * لكل سؤال: رتبة أول مادة متوقعة في أعلى 10، ومنها hit@1 وhit@3 وhit@10 وMRR. وبوابات التسليم (#943) تُقاس
 * منفصلة ولا تدخل في المتوسط. قراءة فقط: استعلامات SELECT ونداء تضمين للسؤال إن كان البحث الدلالي مفعّلًا.
 *
 * المخرج: جدول في السجل، وJSON في EVAL_EVERYDAY_OUT إن ضُبط، وتعليقات ::notice (تُقرأ من واجهة check-runs حين
 * لا يتاح تنزيل السجل)، وملخص في GITHUB_STEP_SUMMARY.
 *
 * التشغيل:  npm run eval:everyday            (تقرير)
 *           npm run eval:everyday -- --gate  (يفشل إن سقطت بوابة)
 *           متغيرات: EVAL_EVERYDAY=path  EVAL_EVERYDAY_LIMIT=10  EVAL_EVERYDAY_VARIANTS='[{"name":"x","opts":{...}}]'
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as adapter from "@/lib/mcp/adapter";
import { handleResolve } from "@/lib/mcp/tools/catalog";
import { compileTerm, matchesNormalized, normalizeAr } from "@/lib/mcp/tools/word-match";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { prisma } from "@/lib/prisma";

type Expected = { article_id: string; law: string; article: number; why?: string };
type Query = { id: string; query: string; law_id?: string; register?: string; domain?: string; expected: Expected[] };
type Gate = {
  id: string;
  query: string;
  kind: "rank1" | "top3" | "rank1_and_all_top3" | "term_precision10" | "resolve_first" | "law_top3";
  law_id?: string;
  expected?: Expected[];
  term?: string;
  min?: number;
  law_id_expected?: string;
};
type Fixture = { version: number; queries: Query[]; gates: Gate[] };
type Variant = { name: string; opts?: Record<string, unknown> };
type Row = { article_id: string; law: string; law_id: string | null; article_number: number; snippet?: string };

const LIMIT = Math.min(Math.max(Number(process.env.EVAL_EVERYDAY_LIMIT) || 10, 3), 20);
const GATE_MODE = process.argv.includes("--gate");

function loadFixture(): Fixture {
  const p = resolve(process.cwd(), process.env.EVAL_EVERYDAY || "data/eval/everyday-queries.json");
  return JSON.parse(readFileSync(p, "utf8")) as Fixture;
}

function variants(): Variant[] {
  const raw = process.env.EVAL_EVERYDAY_VARIANTS;
  if (!raw) return [{ name: "default" }];
  const v = JSON.parse(raw) as Variant[];
  return Array.isArray(v) && v.length ? v : [{ name: "default" }];
}

type SearchFn = (q: string, lawId?: string, limit?: number, opts?: Record<string, unknown>) => Promise<{ results: Row[] }>;
const search = adapter.searchArticles as unknown as SearchFn;

async function runSearch(q: string, lawId: string | undefined, opts: Record<string, unknown> | undefined) {
  const t0 = Date.now();
  try {
    const r = await search(q, lawId, LIMIT, opts ?? {});
    return { rows: r.results ?? [], ms: Date.now() - t0, error: null as string | null };
  } catch (e) {
    return { rows: [] as Row[], ms: Date.now() - t0, error: e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : "unknown" };
  }
}

function rankOf(rows: Row[], expected: Expected[]): number | null {
  const ids = new Set(expected.map((e) => e.article_id));
  const i = rows.findIndex((r) => ids.has(r.article_id));
  return i >= 0 ? i + 1 : null;
}

const short = (law: string) => law.replace(/^(نظام|اللائحة التنفيذية لنظام|لائحة|تنظيم)\s+/, "").slice(0, 18);
const top3 = (rows: Row[]) => rows.slice(0, 3).map((r) => `${short(r.law)}${r.article_number}`).join("،");

async function evalGate(g: Gate, opts: Record<string, unknown> | undefined) {
  if (g.kind === "resolve_first") {
    const r = (await handleResolve(prismaSqlClient(prisma), { q: g.query, limit: 3 })) as { candidates?: Array<{ law_id?: string; name?: string }> };
    const first = (r.candidates ?? [])[0];
    const id = first?.law_id ?? null;
    return { id: g.id, pass: id === g.law_id_expected, detail: `first=${first?.name ?? "—"}` };
  }
  const { rows, error } = await runSearch(g.query, g.law_id, opts);
  if (error) return { id: g.id, pass: false, detail: `error ${error}` };
  if (g.kind === "law_top3") {
    const hit = rows.slice(0, 3).some((r) => r.law_id === g.law_id_expected);
    return { id: g.id, pass: hit, detail: `top3=${top3(rows)}` };
  }
  if (g.kind === "term_precision10") {
    const t = compileTerm(g.term ?? g.query, "derivatives");
    const ids = rows.slice(0, 10).map((r) => r.article_id);
    const full: Array<{ id: string; content: string | null }> = await prisma.legalArticle.findMany({ where: { id: { in: ids } }, select: { id: true, content: true } });
    const byId = new Map<string, string>(full.map((x: { id: string; content: string | null }) => [x.id, x.content ?? ""]));
    const ok = rows.slice(0, 10).filter((r) => t && (matchesNormalized(normalizeAr(byId.get(r.article_id) ?? ""), t) || matchesNormalized(normalizeAr(r.snippet ?? ""), t))).length;
    const inLaw = rows.slice(0, 10).every((r) => !g.law_id || r.law_id === g.law_id);
    const prec = rows.length ? ok / Math.min(10, rows.length) : 0;
    return { id: g.id, pass: rows.length >= 10 && inLaw && prec >= (g.min ?? 1), detail: `n=${rows.length} precision=${prec.toFixed(2)} inLaw=${inLaw}` };
  }
  const exp = g.expected ?? [];
  const r = rankOf(rows, exp);
  if (g.kind === "rank1") return { id: g.id, pass: r === 1, detail: `rank=${r ?? "—"} top3=${top3(rows)}` };
  if (g.kind === "top3") return { id: g.id, pass: r !== null && r <= 3, detail: `rank=${r ?? "—"} top3=${top3(rows)}` };
  // rank1_and_all_top3
  const allTop3 = exp.every((e) => rows.slice(0, 3).some((x) => x.article_id === e.article_id));
  return { id: g.id, pass: r === 1 && allTop3, detail: `rank=${r ?? "—"} allTop3=${allTop3} top3=${top3(rows)}` };
}

function annotate(kind: "notice" | "warning", title: string, body: string) {
  // GitHub يقرأ أمر التعليق سطرًا واحدًا: الأسطر الجديدة تُرمَّز.
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

async function main() {
  const fx = loadFixture();
  const report: Record<string, unknown> = { fixture_version: fx.version, limit: LIMIT, variants: [] as unknown[] };
  let gateFailed = false;
  let first: Map<string, number | null> | null = null;
  let warnings = 0;
  const CONCURRENCY = Math.min(Math.max(Number(process.env.EVAL_EVERYDAY_CONCURRENCY) || 1, 1), 4);
  for (const v of variants()) {
    type Per = { id: string; rank: number | null; ms: number; top3: string; error: string | null };
    const per: Per[] = new Array(fx.queries.length);
    let next = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let i = next++; i < fx.queries.length; i = next++) {
          const q = fx.queries[i];
          const { rows, ms, error } = await runSearch(q.query, q.law_id, v.opts);
          per[i] = { id: q.id, rank: error ? null : rankOf(rows, q.expected), ms, top3: top3(rows), error };
        }
      }),
    );
    const n = per.length;
    const hitAt = (k: number) => per.filter((p) => p.rank !== null && p.rank <= k).length / n;
    const mrr = per.reduce((s, p) => s + (p.rank ? 1 / p.rank : 0), 0) / n;
    const ms = per.map((p) => p.ms).sort((a, b) => a - b);
    const summary = {
      n,
      hit1: +hitAt(1).toFixed(3),
      hit3: +hitAt(3).toFixed(3),
      hit10: +hitAt(10).toFixed(3),
      mrr: +mrr.toFixed(3),
      errors: per.filter((p) => p.error).length,
      p50_ms: ms[Math.floor(n / 2)] ?? 0,
      p95_ms: ms[Math.min(n - 1, Math.floor(n * 0.95))] ?? 0,
    };
    const gates = [] as Array<{ id: string; pass: boolean; detail: string }>;
    for (const g of fx.gates) gates.push(await evalGate(g, v.opts));
    if (gates.some((g) => !g.pass)) gateFailed = true;

    console.log(`\n══ variant=${v.name} opts=${JSON.stringify(v.opts ?? {})}`);
    console.log(`hit@1=${summary.hit1} hit@3=${summary.hit3} hit@10=${summary.hit10} MRR=${summary.mrr} errors=${summary.errors} p50=${summary.p50_ms}ms p95=${summary.p95_ms}ms`);
    for (const p of per) console.log(`  ${String(p.rank ?? "—").padStart(2)}  ${p.id}  [${p.top3}]${p.error ? `  ERROR ${p.error}` : ""}`);
    for (const g of gates) console.log(`  gate ${g.pass ? "PASS" : "FAIL"} ${g.id} ${g.detail}`);

    const head = `variant=${v.name} n=${n} hit1=${summary.hit1} hit3=${summary.hit3} hit10=${summary.hit10} mrr=${summary.mrr} errors=${summary.errors} p50=${summary.p50_ms} p95=${summary.p95_ms}`;
    const gateLine = gates.map((g) => `${g.id}=${g.pass ? "PASS" : "FAIL"}(${g.detail})`).join("\n");
    annotate("notice", `everyday ${v.name} summary`, `${head}\n${gateLine}`);
    // الإعداد الأول: الرتب كلها؛ وما بعده: ما تغيّرت رتبته عن الأول وحده (حد التعليقات 10 لكل خطوة).
    const lines = first
      ? per.filter((p) => first!.get(p.id) !== p.rank).map((p) => `${p.id}: ${first!.get(p.id) ?? "-"}→${p.rank ?? "-"} |${p.top3}`)
      : per.map((p) => `${p.id}=${p.rank ?? "-"}|${p.ms}|${p.top3}${p.error ? `|ERR ${p.error}` : ""}`);
    if (!first) first = new Map(per.map((p) => [p.id, p.rank]));
    for (const [i, c] of chunks(lines.length ? lines : ["(لا تغيير عن الإعداد الأول)"]).entries()) {
      if (warnings >= 10) break;
      annotate("warning", `everyday ${v.name} ranks ${i + 1}`, c);
      warnings++;
    }

    (report.variants as unknown[]).push({ name: v.name, opts: v.opts ?? {}, summary, gates, per });
    if (process.env.GITHUB_STEP_SUMMARY) {
      const md = [`### everyday — ${v.name}`, "", `| hit@1 | hit@3 | hit@10 | MRR | errors | p50 ms | p95 ms |`, `|---|---|---|---|---|---|---|`,
        `| ${summary.hit1} | ${summary.hit3} | ${summary.hit10} | ${summary.mrr} | ${summary.errors} | ${summary.p50_ms} | ${summary.p95_ms} |`, "",
        ...gates.map((g) => `- ${g.pass ? "✅" : "❌"} ${g.id}: ${g.detail}`), "",
        "| id | rank | top3 |", "|---|---|---|", ...per.map((p) => `| ${p.id} | ${p.rank ?? "—"} | ${p.top3} |`), ""].join("\n");
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, md + "\n");
    }
  }
  if (process.env.EVAL_EVERYDAY_OUT) writeFileSync(process.env.EVAL_EVERYDAY_OUT, JSON.stringify(report, null, 2));
  await prisma.$disconnect().catch(() => undefined);
  if (GATE_MODE && gateFailed) {
    console.error("::error::سقطت بوابة أو أكثر (انظر السجل).");
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error("eval-everyday failed:", e instanceof Error ? e.message : e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
