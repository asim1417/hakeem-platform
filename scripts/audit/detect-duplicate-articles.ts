/**
 * detect-duplicate-articles — يكشف المواد المكررة داخل النظام الواحد (البند 1.5).
 * التكرار = نصّان متطابقان (بعد التطبيع) لمادّتين مختلفتين في النظام نفسه.
 *
 * ⚠️ قراءة فقط — لا يؤرشف ولا يحذف. يُخرج تقريرًا للمراجعة البشرية (مطابقة المصدر
 * قبل أرشفة أي صفّ)، لأن تطابق النصّ وحده قد يكون مشروعًا أحيانًا.
 *
 * التشغيل: npx tsx scripts/audit/detect-duplicate-articles.ts [outDir]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { normalizeArabic } from "../../lib/modules/legal-core/bm25-tokenizer";

const OUT = process.argv[2] || "reports/legal-source-integrity";
const sha = (s: string) => crypto.createHash("sha256").update(normalizeArabic(s)).digest("hex");

interface DupGroup { law: string; hash: string; articles: number[]; sample: string; }

async function main() {
  const prisma = new PrismaClient();
  fs.mkdirSync(OUT, { recursive: true });
  const groups: DupGroup[] = [];
  try {
    const laws = await prisma.legalArticle.groupBy({ by: ["lawName"], _count: { _all: true } });
    for (const { lawName } of laws) {
      const rows = await prisma.legalArticle.findMany({
        where: { lawName, articleNumber: { gt: 0 } },
        select: { articleNumber: true, content: true },
      });
      const byHash = new Map<string, { nums: number[]; sample: string }>();
      for (const r of rows) {
        const t = String(r.content ?? "").trim();
        if (t.length < 25) continue; // نصوص قصيرة جدًا (كإحالة) نتجاهلها لتقليل الضجيج
        const h = sha(t);
        const e = byHash.get(h) ?? { nums: [], sample: t.slice(0, 80) };
        e.nums.push(r.articleNumber);
        byHash.set(h, e);
      }
      for (const [h, e] of byHash) {
        if (e.nums.length > 1) groups.push({ law: lawName, hash: h, articles: e.nums.sort((a, b) => a - b), sample: e.sample });
      }
    }

    groups.sort((a, b) => b.articles.length - a.articles.length);
    const totalDupRows = groups.reduce((s, g) => s + (g.articles.length - 1), 0);
    const report = {
      generatedAt: new Date().toISOString(),
      systemsAffected: new Set(groups.map((g) => g.law)).size,
      duplicateGroups: groups.length,
      redundantRows: totalDupRows,
      note: "قراءة فقط — لا أرشفة تلقائية. راجِع كل مجموعة مقابل المصدر الرسمي قبل أرشفة الصفّ الزائد (يُوسم archived_at لا يُحذف).",
      groups: groups.slice(0, 500),
    };
    fs.writeFileSync(path.join(OUT, "duplicate-articles.json"), JSON.stringify(report, null, 2) + "\n", "utf8");

    console.log(`أنظمة متأثّرة: ${report.systemsAffected} | مجموعات تكرار: ${groups.length} | صفوف زائدة: ${totalDupRows}`);
    for (const g of groups.slice(0, 15)) console.log(`  ${g.law.slice(0, 40).padEnd(40)} م[${g.articles.join(", ")}] — «${g.sample}…»`);
    console.log(`\n→ ${OUT}/duplicate-articles.json`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
