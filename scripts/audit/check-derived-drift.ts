/**
 * فحص انجراف الطبقات المشتقّة عن Neon — قراءة فقط.
 *
 * الغرض: كشف تأخّر أي مشتقّ عن المصدر الوحيد للحقيقة فور حدوثه.
 * هذا الفحص وحده كان سيكشف تأخّر فهرس BM25 بـ1,421 مادة (15 لائحة تنفيذية)
 * يوم حدوثه بدل أن يبقى خفيًا. انظر reports/legal-data-audit-2026-09-11/.
 *
 * التشغيل: npx tsx scripts/audit/check-derived-drift.ts
 * يخرج برمز 1 عند وجود انجراف — صالح للتشغيل في CI.
 */
import fs from "node:fs";
import zlib from "node:zlib";
import { PrismaClient } from "@prisma/client";

type Row = { law_name: string; article_number: number };

async function main() {
  const prisma = new PrismaClient();
  let failed = false;
  try {
    // ① المصدر الوحيد للحقيقة
    const dbRows = await prisma.legalArticle.groupBy({
      by: ["lawName"],
      _count: { _all: true },
    });
    const db = new Map(dbRows.map((r) => [r.lawName, r._count._all]));
    const dbTotal = [...db.values()].reduce((a, b) => a + b, 0);

    // ② الطبقة المشتقّة: فهرس BM25
    const idx = JSON.parse(
      zlib.gunzipSync(fs.readFileSync("data/legal-bm25-index.json.gz")).toString("utf8")
    ) as { params: { N: number }; meta: Record<string, Row> };
    const bm = new Map<string, number>();
    for (const m of Object.values(idx.meta)) bm.set(m.law_name, (bm.get(m.law_name) ?? 0) + 1);
    const bmTotal = idx.params.N;

    console.log(`Neon : ${db.size} نظامًا | ${dbTotal} مادة`);
    console.log(`BM25 : ${bm.size} نظامًا | ${bmTotal} مادة`);

    const missing = [...db].filter(([law]) => !bm.has(law));
    const counts = [...db].filter(([law, n]) => bm.has(law) && bm.get(law) !== n);
    const extra = [...bm].filter(([law]) => !db.has(law));

    if (missing.length) {
      failed = true;
      const lost = missing.reduce((a, [, n]) => a + n, 0);
      console.error(`\n❌ ${missing.length} نظامًا في Neon وغائب عن الاسترجاع (${lost} مادة):`);
      for (const [law, n] of missing.sort((a, b) => b[1] - a[1])) console.error(`   ${String(n).padStart(5)} | ${law}`);
    }
    if (counts.length) {
      failed = true;
      console.error(`\n❌ ${counts.length} نظامًا يختلف عدد مواده بين Neon والفهرس:`);
      for (const [law, n] of counts) console.error(`   Neon ${n} ≠ BM25 ${bm.get(law)} | ${law}`);
    }
    if (extra.length) {
      failed = true;
      console.error(`\n❌ ${extra.length} نظامًا في الفهرس وغير موجود في Neon:`);
      for (const [law] of extra) console.error(`   ${law}`);
    }

    console.log(failed
      ? "\n⇒ انجراف مُكتشَف: أعد بناء الفهرس من Neon (build-bm25-index.ts --from-db) بعد اعتماد Neon."
      : "\n✓ لا انجراف — الفهرس مطابق لـNeon.");
  } finally {
    await prisma.$disconnect();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
