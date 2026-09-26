/**
 * dryrun-judgment-sanitize.ts — عيّنة قراءة فقط من Neon لتصنيف تشوّهات الأحكام.
 *
 * لا يكتب شيئاً في القاعدة. يطبّق sanitizeJudgmentDisplay + classifyJudgmentText
 * على عيّنة (افتراضي 500) ويخرج تقريراً JSON.
 *
 * التشغيل:
 *   DATABASE_URL=<Neon> npm run dryrun:judgment-sanitize
 * متغيّرات: SAMPLE_SIZE=500  OUT=reports/judgment-sanitize-dryrun.json
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  classifyJudgmentText,
  type JudgmentTextClass,
} from "../lib/modules/legal-core/display-text";

const SAMPLE = Math.min(Math.max(Number(process.env.SAMPLE_SIZE || 500), 50), 5000);
const OUT = process.env.OUT || "reports/judgment-sanitize-dryrun.json";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL مطلوب (قراءة فقط)");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const counts: Record<JudgmentTextClass, number> = { clean: 0, auto_fixable: 0, needs_human: 0 };
  const opHist: Record<string, number> = {};
  const flagHist: Record<string, number> = {};
  const samples: Array<Record<string, unknown>> = [];

  try {
    const total = await prisma.judicialCase.count();

    // عيّنة متحيّزة نحو التشوّهات المعروفة (أنماط LIKE بسيطة — بلا regex معقّد على Postgres)
    const biased = await prisma.$queryRaw<Array<{ id: string; court: string | null; judgmentText: string }>>`
      SELECT id, court, "judgmentText"
      FROM judicial_cases
      WHERE "judgmentText" LIKE '%عضوفرحان%'
         OR "judgmentText" LIKE '%عضومحمد%'
         OR "judgmentText" LIKE '%عضوناصر%'
         OR "judgmentText" LIKE '%رئيسالدائرة%'
         OR "judgmentText" LIKE '%رئيس الدائرةع%'
         OR "judgmentText" LIKE '%رئيس الدائرةم%'
         OR "judgmentText" LIKE '%رئيس الدائرة القضائية%'
         OR "judgmentText" LIKE '%???%'
         OR "judgmentText" LIKE '%' || CHR(8203) || '%'
         OR "judgmentText" LIKE '%' || CHR(8206) || '%'
         OR "judgmentText" LIKE '%' || CHR(8207) || '%'
         OR "judgmentText" LIKE '%ــــ%'
      ORDER BY id
      LIMIT ${Math.floor(SAMPLE * 0.7)}
    `;

    const remain = Math.max(0, SAMPLE - biased.length);
    const random = remain
      ? await prisma.$queryRaw<Array<{ id: string; court: string | null; judgmentText: string }>>`
          SELECT id, court, "judgmentText"
          FROM judicial_cases
          TABLESAMPLE SYSTEM (2)
          LIMIT ${remain}
        `.catch(async () => {
          // TABLESAMPLE قد لا يُتاح على بعض الخطط — سقوط إلى OFFSET عشوائي تقريبي
          const skip = Math.floor(Math.random() * Math.max(1, total - remain));
          return prisma.judicialCase.findMany({
            skip,
            take: remain,
            select: { id: true, court: true, judgmentText: true },
            orderBy: { id: "asc" },
          });
        })
      : [];

    const seen = new Set<string>();
    const rows = [...biased, ...random].filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    for (const r of rows) {
      const report = classifyJudgmentText(r.judgmentText);
      counts[report.class] += 1;
      for (const op of report.ops) opHist[op] = (opHist[op] || 0) + 1;
      for (const f of report.flags) flagHist[f] = (flagHist[f] || 0) + 1;

      if (samples.length < 40 && (report.changed || report.flags.length || report.class !== "clean")) {
        const beforeTail = (r.judgmentText ?? "").slice(-140).replace(/\s+/g, " ");
        const afterTail = report.sanitized.slice(-140).replace(/\s+/g, " ");
        samples.push({
          id: r.id,
          court: r.court,
          class: report.class,
          ops: report.ops,
          flags: report.flags,
          beforeLen: report.beforeLen,
          afterLen: report.afterLen,
          beforeTail,
          afterTail,
        });
      }
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      mode: "dry-run (read-only — no DB writes)",
      corpusTotal: total,
      sampleSize: rows.length,
      sampleNote: "≈70% متحيّزة لأنماط التشوّه المعروفة + بقية عشوائية",
      counts,
      opHist,
      flagHist,
      samples,
      nextSteps: [
        "مراجعة العيّنات في samples يدوياً قبل أي كتابة",
        "عند الموافقة: تطبيق sanitizeJudgmentDisplay على عمود search_norm / طبقة العرض فقط",
        "لا تُملأ ??? ولا تُصلح الحروف الناقصة آلياً",
      ],
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n", "utf8");

    console.log("=".repeat(72));
    console.log("dry-run تنقية الأحكام — قراءة فقط");
    console.log("=".repeat(72));
    console.log(`corpus=${total.toLocaleString("en-US")}  sample=${rows.length}`);
    console.log("counts:", counts);
    console.log("ops:", opHist);
    console.log("flags:", flagHist);
    console.log(`→ ${OUT}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("فشل dry-run:", e instanceof Error ? e.message : e);
  process.exit(1);
});
