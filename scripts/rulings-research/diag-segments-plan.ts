/**
 * diag-segments-plan — تشخيص قراءة فقط لبطء مرشحي ruling_segments: الفهرس، والإحصاءات، وخطة التنفيذ.
 * لا يطبع نصوصًا ولا معرّفات: أنواع عُقد الخطة وأزمنتها وعدد الصفوف فقط.
 */
import { prisma } from "../../lib/prisma";
import { buildRulingTsQuery } from "../../lib/modules/legal-core/ruling-excerpts";
import { searchRulingsDirect } from "../../lib/modules/legal-core/rulings-search";

async function main() {
  const [ro] = await prisma.$queryRawUnsafe<Array<{ transaction_read_only: string }>>("SHOW transaction_read_only");
  if (ro?.transaction_read_only !== "on") {
    console.error("الجلسة ليست للقراءة فقط — أوقفتُ التشغيل.");
    process.exit(3);
  }
  const idx = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('ruling_segments','ruling_meta')`);
  const stats = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT relname, n_live_tup::int, last_analyze::text, last_autoanalyze::text FROM pg_stat_user_tables WHERE relname IN ('ruling_segments','ruling_meta','judicial_cases')`);
  console.log(JSON.stringify({ indexes: idx, stats }));
  for (const q of ["نجش", "الغبن", "التقادم", "عقد"]) {
    const tsq = buildRulingTsQuery(q)!;
    const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(
      `EXPLAIN (ANALYZE, FORMAT JSON) WITH segm AS MATERIALIZED (
         SELECT "ruling_id" FROM "ruling_segments"
         WHERE to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) AND "part" IN ('reasons','disposition'))
       SELECT DISTINCT "ruling_id" FROM segm LIMIT 400`, tsq);
    const root = (plan[0]["QUERY PLAN"] as Array<{ Plan: Record<string, unknown>; "Execution Time": number }>)[0];
    const nodes: string[] = [];
    const walk = (n: Record<string, unknown>, d = 0) => {
      nodes.push(`${"  ".repeat(d)}${n["Node Type"]}${n["Index Name"] ? ` [${n["Index Name"]}]` : ""} rows=${n["Actual Rows"]} ms=${n["Actual Total Time"]}`);
      for (const c of (n.Plans as Array<Record<string, unknown>> | undefined) ?? []) walk(c, d + 1);
    };
    walk(root.Plan);
    console.log(`::notice title=plan-v2 ${q}::${root["Execution Time"]}ms | ${nodes.join(" / ")}`);
  }
  // زمن البحث الكامل (لفظي فقط) على ألفاظ القياس السابق.
  process.env.RULINGS_SEMANTIC = "off";
  const times: string[] = [];
  for (const q of ["نجش", "الغبن", "التقادم", "الشفعة", "فسخ", "عقد", "مدعي", "النفقة", "كمبيالة"]) {
    const t = Date.now();
    const r = await searchRulingsDirect({ query: q, limit: 10 });
    times.push(`${q}=${Date.now() - t}ms/${r.hits.length}`);
  }
  console.log(`::notice title=search latency::${times.join(" ")}`);
}
main().catch((e) => { console.error("فشل:", (e as Error).message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
