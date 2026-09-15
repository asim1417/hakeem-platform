/**
 * تدقيق ترقيم شامل لكل الأنظمة في المدونة (المهمة «ب» من أمر التشغيل).
 *
 * المنهج: يقارن رقم كل مادة بالعدد الترتيبي المكتوب في عنوانها الرسمي —
 * حقلان مستقلّا المصدر. هذا ما يكشف الانزياح الذي لا يكشفه عدّ المواد ولا
 * قيد @@unique([lawName, articleNumber]).
 *
 * ⚠️ قراءة فقط. لا يكتب على القاعدة إطلاقًا. يُخرج مقترحات لا إصلاحات.
 *
 * التشغيل: npx tsx scripts/audit/audit-all-numbering.ts [outDir]
 * المخرجات: audit_report.csv · number_map_<law>.json · quarantine.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { parseArabicOrdinal, normalizeArabic } from "../../lib/modules/legal-core/arabic-ordinal";

const OUT = process.argv[2] || "reports/numbering-audit";
const sha = (s: string) => crypto.createHash("sha256").update(normalizeArabic(s)).digest("hex");
const cell = (v: unknown) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return /[",]/.test(s) ? `"${s}"` : s;
};

type Status = "clean" | "shift" | "irregular" | "duplicate" | "gap" | "no_ordinal_titles" | "mixed";

interface Row { articleNumber: number; title: string | null; content: string }

/** يقسّم الإزاحات إلى مقاطع متصلة ثابتة الإزاحة — لا يفترض انتظامها. */
function offsetRuns(pairs: Array<{ n: number; off: number }>) {
  const runs: Array<{ from: number; to: number; off: number; count: number }> = [];
  for (const p of pairs) {
    const last = runs[runs.length - 1];
    if (last && last.off === p.off && p.n === last.to + 1) { last.to = p.n; last.count++; }
    else runs.push({ from: p.n, to: p.n, off: p.off, count: 1 });
  }
  return runs;
}

async function main() {
  const prisma = new PrismaClient();
  fs.mkdirSync(OUT, { recursive: true });
  const csv: unknown[][] = [];
  const quarantine: Array<Record<string, unknown>> = [];

  try {
    const laws = await prisma.legalArticle.groupBy({ by: ["lawName"], _count: { _all: true } });
    console.log(`الأنظمة في المدونة: ${laws.length}\n`);

    for (const { lawName } of laws.sort((a, b) => a.lawName.localeCompare(b.lawName, "ar"))) {
      const rows = (await prisma.legalArticle.findMany({
        where: { lawName, articleNumber: { gt: 0 } },
        select: { articleNumber: true, title: true, content: true },
        orderBy: { articleNumber: "asc" },
      })) as Row[];
      if (!rows.length) continue;

      // ① الرقم مقابل العنوان
      const mism: Array<{ n: number; off: number; parsed: number }> = [];
      let parsedCount = 0;
      for (const r of rows) {
        const p = parseArabicOrdinal(r.title ?? "");
        if (p === null) continue;
        parsedCount++;
        if (p !== r.articleNumber) mism.push({ n: r.articleNumber, off: p - r.articleNumber, parsed: p });
      }

      // ② الفجوات وتكرار الأرقام والنصوص
      const nums = rows.map((r) => r.articleNumber);
      const max = Math.max(...nums);
      const seen = new Map<number, number>();
      for (const n of nums) seen.set(n, (seen.get(n) ?? 0) + 1);
      const gaps: number[] = [];
      for (let i = 1; i <= max; i++) if (!seen.has(i)) gaps.push(i);
      const dupNums = [...seen].filter(([, c]) => c > 1).map(([n]) => n);
      const byHash = new Map<string, number[]>();
      for (const r of rows) {
        const t = String(r.content ?? "").trim();
        if (!t) continue;
        byHash.set(sha(t), [...(byHash.get(sha(t)) ?? []), r.articleNumber]);
      }
      const dupText = [...byHash.values()].filter((v) => v.length > 1);

      // ③ التصنيف
      const ordinalCoverage = rows.length ? parsedCount / rows.length : 0;
      const runs = offsetRuns(mism.map((m) => ({ n: m.n, off: m.off })));
      let status: Status = "clean";
      let firstBad = "";
      let numberMap: Record<string, unknown> | null = null;

      if (ordinalCoverage < 0.5) {
        status = "no_ordinal_titles";
        firstBad = `تغطية العناوين الترتيبية ${Math.round(ordinalCoverage * 100)}% — يلزم سحب المواد المعنونة من البوابة للمطابقة`;
      } else if (mism.length) {
        const big = runs.filter((r) => r.count >= 3);
        const uniformOffsets = new Set(big.map((r) => r.off));
        if (big.length && big.reduce((a, r) => a + r.count, 0) >= mism.length * 0.9 && uniformOffsets.size === 1) {
          status = "shift";
          firstBad = `shift@${big[0].from} (إزاحة ${[...uniformOffsets][0]})`;
          numberMap = {
            law: lawName,
            generated_at: new Date().toISOString().slice(0, 10),
            note: "مقترح آليّ — يلزم إثبات النمط بمراسٍ خارجية من البوابة قبل الاعتماد.",
            rules: runs.map((r) => ({ range: `${r.from}–${r.to}`, map: `${r.off > 0 ? "+" : ""}${r.off}`, count: r.count })),
          };
        } else {
          status = "irregular";
          firstBad = `إزاحات غير منتظمة عند: ${mism.slice(0, 5).map((m) => `${m.n}→${m.parsed}`).join(" · ")}`;
        }
      }
      if (dupText.length || dupNums.length) status = status === "clean" ? "duplicate" : "mixed";
      else if (gaps.length && status === "clean") status = "gap";

      if (status !== "clean") {
        quarantine.push({
          law: lawName, status, articles: rows.length,
          mismatches: mism.length, gaps: gaps.length,
          duplicate_text_groups: dupText.map((d) => d.join("+")),
          reason: "يُمنع إدراج أو تطبيق أي legal_effect أو استشهاد يستهدف هذا النظام حتى الإصلاح",
        });
        if (numberMap) {
          const safe = lawName.replace(/[^\p{L}\p{N}]+/gu, "_").slice(0, 60);
          fs.writeFileSync(path.join(OUT, `number_map_${safe}.json`), JSON.stringify(numberMap, null, 2) + "\n", "utf8");
        }
      }

      csv.push([lawName, rows.length, max, status, firstBad, mism.length, gaps.length,
        dupNums.join("|"), dupText.map((d) => d.join("+")).join("|"),
        `${Math.round(ordinalCoverage * 100)}%`]);

      const mark = status === "clean" ? "✅" : status === "no_ordinal_titles" ? "❔" : "❌";
      console.log(`${mark} ${String(rows.length).padStart(4)} مادة | ${status.padEnd(18)} | ${lawName.slice(0, 52)}${firstBad ? " | " + firstBad : ""}`);
    }

    const header = ["law", "count", "max_number", "status", "first_bad", "mismatches", "gaps",
      "duplicate_numbers", "duplicate_text_groups", "ordinal_title_coverage"];
    fs.writeFileSync(path.join(OUT, "audit_report.csv"),
      "﻿" + [header.join(","), ...csv.map((r) => r.map(cell).join(","))].join("\n") + "\n", "utf8");
    fs.writeFileSync(path.join(OUT, "quarantine.json"),
      JSON.stringify({ generated_at: new Date().toISOString(), count: quarantine.length, systems: quarantine }, null, 2) + "\n", "utf8");

    const bad = csv.filter((r) => r[3] !== "clean").length;
    console.log(`\n${"─".repeat(60)}`);
    console.log(`الأنظمة: ${csv.length} | سليمة: ${csv.length - bad} | تحتاج مراجعة: ${bad}`);
    console.log(`→ ${OUT}/audit_report.csv · quarantine.json · number_map_*.json`);
    console.log("\n⚠️ المخرجات مقترحات لا إصلاحات. أثبِت نمط أي إزاحة بمراسٍ من هيئة الخبراء قبل الاعتماد.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
