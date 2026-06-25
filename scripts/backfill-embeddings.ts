/**
 * backfill-embeddings.ts — يولّد متجهات دلالية (Embeddings) لمواد النواة القانونية
 * ويخزّنها **مباشرة في جدول pgvector «embeddings»** (مصدر الحقيقة الوحيد).
 *
 * المرحلة ٥ (توحيد مصدر الـembedding): لم يعد يكتب إلى legal_articles.embedding
 * (Json) — ذلك الحقل مهجور (deprecated/أرشيف). التوليد يذهب للجدول مباشرةً عبر
 * UPSERT على (owner_type='article', owner_id) فلا ازدواج في مصدر الحقيقة.
 *
 * التشغيل (عبر workflow مُقفل فقط — كتابة على القاعدة):
 *   اضبط مفتاح مزوّد التضمين + CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 *   npx tsx scripts/backfill-embeddings.ts            # يملأ المواد التي بلا متجه في الجدول
 *   npx tsx scripts/backfill-embeddings.ts --all      # يعيد توليد الكل
 *   npx tsx scripts/backfill-embeddings.ts --limit 500
 *
 * آمن للاستئناف: يتخطّى ما له متجه في الجدول (إلا مع --all). دفعات مع مهلة لاحترام حدود المعدّل.
 */

import { prisma } from "@/lib/prisma";
import { embedBatch, buildEmbeddingText, EMBEDDING_MODEL } from "@/lib/modules/ai/embeddings";
import { hasValidDimension, buildVectorLiteral } from "@/lib/modules/legal-search/embedding-fallback";

const BATCH = 64;
const DIM = Number(process.env.EMBEDDING_DIMS || 1536);

function assertAlignmentConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error(
      "✗ الكتابة مقفولة. مصدر الحقيقة وقت التشغيل هو Neon. اضبط " +
        "CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED بعد مواءمة DATABASE_URL مع Neon عمداً."
    );
    process.exit(1);
  }
}

/** UPSERT متجه إلى جدول pgvector «embeddings» (المصدر الوحيد). */
async function upsertVector(ownerId: string, literal: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "embeddings" ("id","owner_type","owner_id","embedding","model","created_at")
       VALUES (gen_random_uuid()::text, 'article', $1, $2::vector, $3, now())
       ON CONFLICT ("owner_type","owner_id")
       DO UPDATE SET "embedding" = EXCLUDED."embedding", "model" = EXCLUDED."model"`,
      ownerId,
      literal,
      EMBEDDING_MODEL
    );
    return true;
  } catch {
    return false;
  }
}

/** معرّفات المواد التي لها متجه في الجدول فعلاً (لتخطّيها في الوضع التزايدي). */
async function articleIdsWithVector(): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ owner_id: string }>>(
    `SELECT "owner_id" FROM "embeddings" WHERE "owner_type" = 'article'`
  ).catch(() => [] as Array<{ owner_id: string }>);
  return new Set(rows.map((r) => r.owner_id));
}

async function main() {
  assertAlignmentConfirmed();

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

  const existing = all ? new Set<string>() : await articleIdsWithVector();
  const corpusTotal = await prisma.legalArticle.count();
  console.log(
    `المواد: ${corpusTotal.toLocaleString("ar-SA")} | لها متجه في الجدول: ${existing.size.toLocaleString("ar-SA")} | النموذج: ${EMBEDDING_MODEL} | البُعد: ${DIM}`
  );

  let processed = 0;
  let updated = 0;
  let failed = 0;
  let skippedDim = 0;
  let cursor: string | undefined;

  while (processed < max) {
    const rows = await prisma.legalArticle.findMany({
      select: { id: true, lawName: true, title: true, content: true, legalSystem: { select: { name: true } } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    // الوضع التزايدي: تخطّى ما له متجه في الجدول.
    const pending = all ? rows : rows.filter((r) => !existing.has(r.id));
    if (pending.length) {
      const texts = pending.map((r) =>
        buildEmbeddingText({ systemName: r.legalSystem?.name ?? r.lawName, title: r.title, content: r.content })
      );
      const vectors = await embedBatch(texts);
      for (let i = 0; i < pending.length && processed + i < max; i += 1) {
        const vec = vectors[i] ?? null;
        if (!hasValidDimension(vec, DIM)) {
          skippedDim += 1;
          continue;
        }
        const ok = await upsertVector(pending[i].id, buildVectorLiteral(vec));
        ok ? (updated += 1) : (failed += 1);
      }
      await new Promise((r) => setTimeout(r, 250)); // مهلة بسيطة لحدود المعدّل
    }

    processed += rows.length;
    console.log(`تقدّم: ${processed.toLocaleString("ar-SA")} | مُحدَّث(جدول): ${updated} | متخطّى(بُعد): ${skippedDim} | فشل: ${failed}`);
  }

  console.log(`✓ انتهى. مُحدَّث في جدول pgvector: ${updated.toLocaleString("ar-SA")} | متخطّى(بُعد): ${skippedDim} | فشل: ${failed.toLocaleString("ar-SA")}`);
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
