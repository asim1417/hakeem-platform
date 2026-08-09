/**
 * scripts/backfill/audit.ts — حصر النواقص (ثامنًا-١). قراءة فقط.
 *
 * يكشف كل نظام تنقصه أداة الإصدار و/أو التمهيد بالاعتماد على البيانات القائمة:
 *   - ناقص التمهيد  : لا مادة رقمها 0 «الديباجة» (اصطلاح import-preambles).
 *   - ناقص الأداة   : لا وثيقة إصدار (legal_documents من نوع مرسوم/قرار).
 * يكتب تقرير CSV إلى reports/legal-completeness-audit.csv ويطبع ملخّصًا.
 *
 * ⚠️ يحتاج DATABASE_URL حيًّا (يتخطّى بأمان إن غاب). لا يكتب على القاعدة.
 * تشغيل: npx tsx scripts/backfill/audit.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { prisma } from "@/lib/prisma";

const PREAMBLE_ARTICLE_NUMBER = 0;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || /@localhost|@127\.0\.0\.1/.test(url)) {
    console.log("⏭️  تخطّي: لا DATABASE_URL حيّ — الحصر يحتاج قاعدة.");
    return;
  }

  const systems = await prisma.legalSystem.findMany({
    select: { id: true, name: true, articleCount: true },
    orderBy: { name: "asc" },
  });

  const rows: string[] = ["system_id,name,has_preamble,has_instrument,completeness"];
  let missingPreamble = 0;
  let missingInstrument = 0;
  let complete = 0;

  for (const s of systems) {
    const [preamble, instrument] = await Promise.all([
      prisma.legalArticle.findFirst({ where: { legalSystemId: s.id, articleNumber: PREAMBLE_ARTICLE_NUMBER }, select: { id: true } }),
      prisma.legalDocument.findFirst({
        where: { systemId: s.id, docType: { in: ["ROYAL_DECREE", "COUNCIL_DECISION", "AGENCY_DECISION"] } },
        select: { id: true },
      }),
    ]);
    const hasPreamble = Boolean(preamble);
    const hasInstrument = Boolean(instrument);
    const completeness = hasPreamble && hasInstrument
      ? "COMPLETE"
      : !hasInstrument
        ? "MISSING_INSTRUMENT"
        : "MISSING_PREAMBLE";
    if (completeness === "COMPLETE") complete++;
    if (!hasPreamble) missingPreamble++;
    if (!hasInstrument) missingInstrument++;
    const safeName = `"${s.name.replace(/"/g, '""')}"`;
    rows.push(`${s.id},${safeName},${hasPreamble},${hasInstrument},${completeness}`);
  }

  mkdirSync("reports", { recursive: true });
  const out = "reports/legal-completeness-audit.csv";
  writeFileSync(out, rows.join("\n") + "\n", "utf-8");

  console.log(`الأنظمة: ${systems.length}`);
  console.log(`كامل: ${complete} | ناقص الأداة: ${missingInstrument} | ناقص التمهيد: ${missingPreamble}`);
  console.log(`التقرير: ${out}`);
  console.log(`التقدّم: ${complete}/${systems.length} بحالة «كامل».`);
}

main()
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
