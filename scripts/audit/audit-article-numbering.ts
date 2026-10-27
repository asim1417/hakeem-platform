/**
 * HKM-028: تدقيق ترقيم كل الأنظمة في legal_articles، بقراءة فقط (SET TRANSACTION READ ONLY).
 * يقرأ الرقم والعنوان وأول سطر من المتن (يُقطع إلى 200 حرف ولا يُطبع)، ويطبع خلاصة وجدول الأنظمة غير النظيفة.
 *   npx tsx scripts/audit/audit-article-numbering.ts [--json ملف]
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { FIRST_LINE_FETCH_LIMIT, auditLawNumbering, type NumberingAudit, type NumberingRow } from "../../lib/modules/legal-core/numbering-audit";
import { NON_ARTICLE_BIS } from "../../lib/modules/legal-core/article-key";

const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const short = (xs: number[], k = 8) => (xs.length ? `${xs.slice(0, k).join("،")}${xs.length > k ? "…" : ""}` : "—");

async function main() {
  const prisma = new PrismaClient();
  let rows: Array<NumberingRow & { lawName: string }>;
  try {
    rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return tx.$queryRawUnsafe<Array<NumberingRow & { lawName: string }>>(
        // الصفوف غير المادية (درجة «مكرر» ≥ NON_ARTICLE_BIS) ليست مواد، فلا تدخل في التدقيق.
        // أول سطر من المتن مقطوعًا إلى FIRST_LINE_FETCH_LIMIT حرفًا (لا يُطبع): مصدر العدد الترتيبي حين يكون العنوان رقميًّا (الأمر ٠٨)؛
        // أطول من حارس السطر (80) حتى يُرفض السطر الطويل لا أن يُقطع فيُقرأ.
        `SELECT "lawName", "articleNumber", title, left(btrim(split_part(btrim(content), E'\\n', 1)), ${FIRST_LINE_FETCH_LIMIT}) AS "firstLine"
           FROM legal_articles WHERE "articleBis" < ${NON_ARTICLE_BIS}`,
      );
    });
  } finally {
    await prisma.$disconnect();
  }

  const byLaw = new Map<string, NumberingRow[]>();
  for (const r of rows) {
    const list = byLaw.get(r.lawName) ?? [];
    list.push({ articleNumber: r.articleNumber, title: r.title, firstLine: r.firstLine });
    byLaw.set(r.lawName, list);
  }
  const results: Array<{ lawName: string } & NumberingAudit> = [...byLaw]
    .map(([lawName, list]) => ({ lawName, ...auditLawNumbering(list) }))
    .sort((a, b) => b.mismatched - a.mismatched || a.lawName.localeCompare(b.lawName, "ar"));

  const count = (s: NumberingAudit["status"]) => results.filter((r) => r.status === s).length;
  console.log(`الأنظمة ${results.length} | المواد ${rows.length}`);
  console.log(`نظيف ${count("clean")} | انزياح ${count("shift")} | غير منتظم ${count("irregular")} | بلا عناوين ترتيبية ${count("no_ordinal_titles")}`);
  console.log(`أنظمة فيها أرقام ناقصة بين 1 وأكبر رقم: ${results.filter((r) => r.gaps.length).length}`);
  console.log(`أنظمة قُرئ عددها الترتيبي من أول سطر في المتن: ${results.filter((r) => r.fromContent > 0).length} (${results.reduce((n, r) => n + r.fromContent, 0)} مادة)`);
  console.log(`أنظمة عناوينها رقمية بلا عدد مكتوب في المتن (فحصها دائري): ${results.filter((r) => r.numericTitles > 0).length} (${results.reduce((n, r) => n + r.numericTitles, 0)} مادة)`);
  console.log("");
  console.log("الحالة | النظام | المواد | مقروءة | مختلفة | مكرر العنوان | ناقصة | مقاطع الإزاحة (من–إلى: إزاحة×عدد)");
  for (const r of results.filter((x) => x.status === "shift" || x.status === "irregular")) {
    const runs = r.runs.slice(0, 4).map((x) => `${x.from}–${x.to}: ${x.offset > 0 ? "+" : ""}${x.offset}×${x.count}`).join("، ");
    console.log(`${r.status} | ${r.lawName} | ${r.articles} | ${r.parsed} | ${r.mismatched} | ${short(r.duplicateTitleNumbers)} | ${r.gaps.length} | ${runs}${r.runs.length > 4 ? "…" : ""}`);
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + "\n");
  console.log("");
  console.log(`خلاصة: انزياح ${count("shift")} | غير منتظم ${count("irregular")} | نظيف ${count("clean")} من ${results.length}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(2);
});
