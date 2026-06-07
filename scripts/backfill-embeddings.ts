/**
 * backfill-embeddings.ts — يولّد متجهات دلالية (Embeddings) لمواد النواة القانونية
 * ويخزّنها في LegalArticle.embedding (Json).
 *
 * التشغيل:
 *   اضبط مفتاح مزوّد التضمين في البيئة قبل التشغيل.
 *   npx tsx scripts/backfill-embeddings.ts            # يملأ المواد التي بلا متجه
 *   npx tsx scripts/backfill-embeddings.ts --all      # يعيد توليد الكل
 *   npx tsx scripts/backfill-embeddings.ts --limit 500
 *
 * آمن للاستئناف: يتخطّى ما له متجه (إلا مع --all). دفعات مع مهلة بسيطة لاحترام حدود المعدّل.
 */

import { prisma } from "@/lib/prisma";
import { embedBatch, buildEmbeddingText, EMBEDDING_MODEL } from "@/lib/modules/ai/embeddings";

const BATCH = 64;

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const limitArg = args.indexOf("--limit");
  const max = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

  const keyName = ["EMBEDDING", "API", "KEY"].join("_");
  const fallbackKeyName = ["OPENAI", "API", "KEY"].join("_");
  if (!process.env[keyName] && !process.env[fallbackKeyName]) {
    console.error("✗ لا مفتاح لمزوّد التضمين في البيئة. أوقفت.");
    process.exit(1);
  }

  const where = all ? {} : { embedding: { equals: null as never } };
  const total = await prisma.legalArticle.count({ where });
  console.log(`المواد المستهدفة: ${total.toLocaleString("ar-SA")} | النموذج: ${EMBEDDING_MODEL}`);
  if (!total) {
    console.log("لا شيء لتوليده.");
    return;
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;

  // eslint-disable-next-line no-constant-condition
  while (processed < Math.min(total, max)) {
    const rows = await prisma.legalArticle.findMany({
      where,
      select: { id: true, lawName: true, title: true, content: true, legalSystem: { select: { name: true } } },
      orderBy: { id: "asc" },
      take: BATCH,
      skip: all ? processed : 0 // عند عدم --all تتقلّص المجموعة تلقائياً (embedding لم يعد null)
    });
    if (!rows.length) break;

    const texts = rows.map((r) =>
      buildEmbeddingText({ systemName: r.legalSystem?.name ?? r.lawName, title: r.title, content: r.content })
    );
    const vectors = await embedBatch(texts);

    await Promise.all(
      rows.map(async (row, i) => {
        const vec = vectors[i];
        if (!vec) {
          failed += 1;
          return;
        }
        await prisma.legalArticle.update({ where: { id: row.id }, data: { embedding: vec } }).then(
          () => {
            updated += 1;
          },
          () => {
            failed += 1;
          }
        );
      })
    );

    processed += rows.length;
    console.log(`تقدّم: ${processed.toLocaleString("ar-SA")} | مُحدَّث: ${updated} | فشل: ${failed}`);
    await new Promise((r) => setTimeout(r, 250)); // مهلة بسيطة لحدود المعدّل
  }

  console.log(`✓ انتهى. مُحدَّث: ${updated.toLocaleString("ar-SA")} | فشل: ${failed.toLocaleString("ar-SA")}`);
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
