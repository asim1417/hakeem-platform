/**
 * diag-common-terms-plan — تشخيص قراءة فقط لبطء البحث اللفظي في الأحكام للألفاظ الشائعة.
 * يقيس استعلامَي searchRulingsDirect نفسيهما (buildRulingSearchSql) بـ EXPLAIN ANALYZE ويزمّن كل مرحلة.
 * لا يطبع نصوصًا ولا معرّفات ولا سلسلة اتصال: أنواع العُقد وأسماء الفهارس وعدد الصفوف والأزمنة فقط.
 */
import { prisma } from "../../lib/prisma";
import { buildRulingTsQuery } from "../../lib/modules/legal-core/ruling-excerpts";
import { buildRulingSearchSql, searchRulingsDirect } from "../../lib/modules/legal-core/rulings-search";

type PlanNode = Record<string, unknown>;
const notice = (title: string, msg: string) => console.log(`::notice title=${title}::${msg}`);

function summarize(n: PlanNode, d = 0, out: string[] = []): string[] {
  const bits = [
    `${"·".repeat(d)}${n["Node Type"]}`,
    n["Index Name"] ? `[${n["Index Name"]}]` : "",
    n["CTE Name"] ? `cte=${n["CTE Name"]}` : "",
    n["Subplan Name"] ? `sub=${n["Subplan Name"]}` : "",
    `rows=${n["Actual Rows"]}`,
    Number(n["Actual Loops"] ?? 1) > 1 ? `loops=${n["Actual Loops"]}` : "",
    `ms=${n["Actual Total Time"]}`,
    n["Rows Removed by Index Recheck"] ? `recheckRemoved=${n["Rows Removed by Index Recheck"]}` : "",
    n["Rows Removed by Filter"] ? `filterRemoved=${n["Rows Removed by Filter"]}` : "",
    n["Exact Heap Blocks"] ? `exact=${n["Exact Heap Blocks"]}` : "",
    n["Lossy Heap Blocks"] ? `lossy=${n["Lossy Heap Blocks"]}` : "",
    n["Shared Read Blocks"] ? `read=${n["Shared Read Blocks"]}` : "",
    n["Shared Hit Blocks"] ? `hit=${n["Shared Hit Blocks"]}` : "",
  ].filter(Boolean);
  out.push(bits.join(" "));
  for (const c of (n.Plans as PlanNode[] | undefined) ?? []) summarize(c, d + 1, out);
  return out;
}

async function explain(label: string, sql: string, params: unknown[]) {
  const t = Date.now();
  const r = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, ...params);
  const root = (r[0]["QUERY PLAN"] as Array<{ Plan: PlanNode; "Execution Time": number; "Planning Time": number }>)[0];
  const lines = summarize(root.Plan);
  // سطر لكل ١٢ عقدة كي لا تُقتطع التعليقات.
  for (let i = 0; i < lines.length; i += 12) {
    notice(`${label} ${i ? `(${i / 12 + 1})` : ""}`.trim(), `${i ? "" : `exec=${root["Execution Time"]}ms plan=${root["Planning Time"]}ms wall=${Date.now() - t}ms | `}${lines.slice(i, i + 12).join(" / ")}`);
  }
}

async function timed(sql: string, params: unknown[]): Promise<number> {
  const t = Date.now();
  await prisma.$queryRawUnsafe(sql, ...params);
  return Date.now() - t;
}

async function main() {
  const [ro] = await prisma.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
  if (ro?.transaction_read_only !== "on") {
    console.error("الجلسة ليست للقراءة فقط — أوقفتُ التشغيل.");
    process.exit(3);
  }
  const stats = await prisma.$queryRawUnsafe<Array<{ relname: string; n: number; sz: string }>>(
    `SELECT relname, n_live_tup::int AS n, pg_size_pretty(pg_total_relation_size(relid)) AS sz
     FROM pg_stat_user_tables WHERE relname IN ('ruling_segments','judicial_cases','ruling_meta')`);
  notice("tables", stats.map((s) => `${s.relname}=${s.n}/${s.sz}`).join(" "));

  process.env.RULINGS_SEMANTIC = "off";
  const terms = (process.env.DIAG_TERMS || "الوكالة,عقد,مدعي").split(",");
  const latencyTerms = (process.env.DIAG_LATENCY_TERMS || "الوكالة,عقد,مدعي,نجش,الغبن,الشفعة").split(",");
  // تسخين: كشف الأعمدة والجداول يُخزَّن، فلا يدخل في القياس.
  await searchRulingsDirect({ query: "نجش", limit: 10 });

  for (const q of terms) {
    const sql = await buildRulingSearchSql({ query: q, limit: 10 });
    if (!sql) continue;
    const tsq = buildRulingTsQuery(q)!;
    // أحجام المراحل: كم جزءًا وكم حكمًا يطابق (أرقام فقط).
    const [sz] = await prisma.$queryRawUnsafe<Array<{ segs: number; rulings: number }>>(
      `SELECT count(*)::int AS segs, count(DISTINCT "ruling_id")::int AS rulings FROM "ruling_segments"
       WHERE to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) AND "part" IN ('reasons','disposition')`, tsq);
    const [cand] = await prisma.$queryRawUnsafe<Array<{ avg_bytes: number; max_bytes: number }>>(
      `WITH s AS (SELECT DISTINCT "ruling_id" AS id FROM "ruling_segments"
         WHERE to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) AND "part" IN ('reasons','disposition') LIMIT 400)
       SELECT avg(octet_length(j."search_norm"))::int AS avg_bytes, max(octet_length(j."search_norm"))::int AS max_bytes
       FROM s JOIN "judicial_cases" j ON j."id" = s.id`, tsq);
    notice(`sizes ${q}`, `segments=${sz.segs} rulings=${sz.rulings} cand400_search_norm_avg=${cand.avg_bytes}B max=${cand.max_bytes}B`);

    await explain(`count ${q}`, sql.countSql, sql.params);
    await explain(`rank ${q}`, sql.rowsSql, sql.params);

    // تزمين المراحل منفصلةً (بلا EXPLAIN): العدّ، والترتيب، وكلاهما متوازيين كما في الإنتاج.
    const countMs = await timed(sql.countSql, sql.params);
    const rankMs = await timed(sql.rowsSql, sql.params);
    const t = Date.now();
    await Promise.all([timed(sql.countSql, sql.params), timed(sql.rowsSql, sql.params)]);
    const parMs = Date.now() - t;
    // تكلفة ts_rank_cd وحدها على ٥٠٠ مرشح (النص الكامل)، مقابل الترتيب بلا ts_rank_cd.
    const rankOnly = await timed(
      `WITH s AS (SELECT DISTINCT "ruling_id" AS id FROM "ruling_segments"
         WHERE to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) AND "part" IN ('reasons','disposition') LIMIT 400)
       SELECT max(ts_rank_cd(to_tsvector('simple', coalesce(j."search_norm",'')), to_tsquery('simple', $1))) FROM s JOIN "judicial_cases" j ON j."id" = s.id`, [tsq]);
    const segOnly = await timed(
      `WITH s AS (SELECT DISTINCT "ruling_id" AS id FROM "ruling_segments"
         WHERE to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) AND "part" IN ('reasons','disposition') LIMIT 400)
       SELECT count(*) FROM s`, [tsq]);
    notice(`phases ${q}`, `count=${countMs}ms rank=${rankMs}ms parallel=${parMs}ms | seg400_only=${segOnly}ms seg400+ts_rank_cd(full search_norm)=${rankOnly}ms`);
  }

  const times: string[] = [];
  for (const q of latencyTerms) {
    const t = Date.now();
    const r = await searchRulingsDirect({ query: q, limit: 10 });
    times.push(`${q}=${Date.now() - t}ms/${r.hits.length}/total=${r.total}${r.totalCapped ? "+" : ""}`);
  }
  notice("search latency (lexical)", times.join(" "));
}
main().catch((e) => { console.error("فشل:", (e as Error).message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
