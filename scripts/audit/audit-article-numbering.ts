/**
 * HKM-028: تدقيق ترقيم كل الأنظمة في legal_articles، بقراءة فقط (SET TRANSACTION READ ONLY).
 * يقرأ الرقم والعنوان فقط (لا نصوص المواد)، ويطبع خلاصة وجدول الأنظمة غير النظيفة.
 *   npx tsx scripts/audit/audit-article-numbering.ts [--json ملف]
 */
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { auditLawNumbering, type NumberingAudit, type NumberingRow } from "../../lib/modules/legal-core/numbering-audit";

const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;
const short = (xs: number[], k = 8) => (xs.length ? `${xs.slice(0, k).join("،")}${xs.length > k ? "…" : ""}` : "—");

async function main() {
  const prisma = new PrismaClient();
  let rows: Array<NumberingRow & { lawName: string }>;
  try {
    rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      return tx.$queryRawUnsafe<Array<NumberingRow & { lawName: string }>>(
        `SELECT "lawName", "articleNumber", title FROM legal_articles`,
      );
    });
  } finally {
    await prisma.$disconnect();
  }

  const byLaw = new Map<string, NumberingRow[]>();
  for (const r of rows) {
    const list = byLaw.get(r.lawName) ?? [];
    list.push({ articleNumber: r.articleNumber, title: r.title });
    byLaw.set(r.lawName, list);
  }
  const results: Array<{ lawName: string } & NumberingAudit> = [...byLaw]
    .map(([lawName, list]) => ({ lawName, ...auditLawNumbering(list) }))
    .sort((a, b) => b.mismatched - a.mismatched || a.lawName.localeCompare(b.lawName, "ar"));

  const count = (s: NumberingAudit["status"]) => results.filter((r) => r.status === s).length;
  console.log(`الأنظمة ${results.length} | المواد ${rows.length}`);
  console.log(`نظيف ${count("clean")} | انزياح ${count("shift")} | غير منتظم ${count("irregular")} | بلا عناوين ترتيبية ${count("no_ordinal_titles")}`);
  console.log(`أنظمة فيها أرقام ناقصة بين 1 وأكبر رقم: ${results.filter((r) => r.gaps.length).length}`);
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
