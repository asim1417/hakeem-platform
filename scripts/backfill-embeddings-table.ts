/**
 * backfill-embeddings-table.ts — يعبّئ جدول pgvector «embeddings» من المتجهات
 * الموجودة مسبقاً في legal_articles.embedding (Json)، دون إعادة توليد (بلا تكلفة مزوّد).
 *
 * يحوّل البحث الدلالي من cosine داخل التطبيق (مجموعة محدودة) إلى ANN حقيقي عبر
 * فهرس HNSW على كامل المتجهات. آمن للاستئناف (UPSERT)، ولا يحذف شيئاً.
 *
 * 🔒 لا يعمل إلا بتأكيد مواءمة قاعدة Runtime (Neon) عبر:
 *      CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 *    (دفاع في العمق فوق بوّابة الـ workflow — يمنع الكتابة على القاعدة الخطأ).
 *
 * التشغيل (عبر workflow مُقفل فقط):
 *   CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED npx tsx scripts/backfill-embeddings-table.ts
 *   ... --limit 1000   (اختياري)
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseEmbedding, hasValidDimension, buildVectorLiteral } from "@/lib/modules/legal-search/embedding-fallback";
import { EMBEDDING_MODEL } from "@/lib/modules/ai/embeddings";

const DIM = Number(process.env.EMBEDDING_DIMS || 1536);
const BATCH = 200;

function assertAlignmentConfirmed() {
  if (process.env.CONFIRM_RUNTIME_DB_ALIGNMENT !== "NEON_RUNTIME_CONFIRMED") {
    console.error(
      "✗ الكتابة مقفولة. مصدر الحقيقة وقت التشغيل هو Neon. اضبط " +
        "CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED بعد مواءمة DATABASE_URL مع Neon عمداً."
    );
    process.exit(1);
  }
}

async function upsertVector(ownerId: string, literal: string): Promise<boolean> {
  // owner_id من نوع cuid (أحرف/أرقام) — آمن للإدراج؛ والمتجه أرقام فقط.
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

async function main() {
  assertAlignmentConfirmed();

  const args = process.argv.slice(2);
  const limitArg = args.indexOf("--limit");
  const max = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;

  const where = { embedding: { not: Prisma.AnyNull } };
  const total = await prisma.legalArticle.count({ where });
  console.log(`مواد لها متجه على legal_articles.embedding: ${total.toLocaleString("ar-SA")} | البُعد المتوقّع: ${DIM}`);
  if (!total) {
    console.log("لا متجهات لنقلها (تحقّق أنّ القاعدة هي Neon وأنّ المتجهات موجودة).");
    return;
  }

  let processed = 0;
  let copied = 0;
  let skippedDim = 0;
  let failed = 0;
  let cursor: string | undefined;

  while (processed < Math.min(total, max)) {
    const rows = await prisma.legalArticle.findMany({
      where,
      select: { id: true, embedding: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const row of rows) {
      const vec = parseEmbedding(row.embedding);
      if (!hasValidDimension(vec, DIM)) {
        skippedDim += 1; // بُعد مخالف/غير صالح — يُتخطّى (لا يُفشل العملية)
        continue;
      }
      const ok = await upsertVector(row.id, buildVectorLiteral(vec));
      ok ? (copied += 1) : (failed += 1);
    }

    processed += rows.length;
    console.log(`تقدّم: ${processed.toLocaleString("ar-SA")} | منقول: ${copied} | متخطّى(بُعد): ${skippedDim} | فشل: ${failed}`);
  }

  console.log(`✓ انتهى. منقول: ${copied.toLocaleString("ar-SA")} | متخطّى(بُعد): ${skippedDim} | فشل: ${failed}`);
  if (skippedDim > 0) {
    console.log(`⚠ ${skippedDim} متجهاً بأبعاد ≠ ${DIM} لم تُنقَل. إن كان نموذج التضمين مختلفاً، عدّل بُعد عمود embeddings والامتداد وفقاً لذلك.`);
  }
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));
