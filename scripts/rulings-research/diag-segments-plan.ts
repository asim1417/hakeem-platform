/**
 * diag-segments-plan — تشخيص قراءة فقط لبطء مرشحي ruling_segments: الفهرس، والإحصاءات، وخطة التنفيذ.
 * لا يطبع نصوصًا ولا معرّفات: أنواع عُقد الخطة وأزمنتها وعدد الصفوف فقط.
 */
import { prisma } from "../../lib/prisma";
import { buildRulingTsQuery } from "../../lib/modules/legal-core/ruling-excerpts";

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
  for (const q of ["نجش", "الغبن", "التقادم"]) {
    const tsq = buildRulingTsQuery(q)!;
    const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(
      `EXPLAIN (ANALYZE, FORMAT JSON) SELECT DISTINCT "ruling_id" FROM "ruling_segments"
       WHERE "part" IN ('reasons','disposition') AND to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) LIMIT 400`, tsq);
    const root = (plan[0]["QUERY PLAN"] as Array<{ Plan: Record<string, unknown>; "Execution Time": number }>)[0];
    const nodes: string[] = [];
    const walk = (n: Record<string, unknown>, d = 0) => {
      nodes.push(`${"  ".repeat(d)}${n["Node Type"]}${n["Index Name"] ? ` [${n["Index Name"]}]` : ""} rows=${n["Actual Rows"]} ms=${n["Actual Total Time"]}`);
      for (const c of (n.Plans as Array<Record<string, unknown>> | undefined) ?? []) walk(c, d + 1);
    };
    walk(root.Plan);
    console.log(`::notice title=plan ${q}::${root["Execution Time"]}ms | ${nodes.join(" / ")}`);
  }
}
main().catch((e) => { console.error("فشل:", (e as Error).message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
