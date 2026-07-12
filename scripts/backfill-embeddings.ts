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

/** UPSERT متجه إلى جدول pgvector «embeddings» لأي نوع مالك (article|ruling|principle). */
async function upsertVector(ownerType: string, ownerId: string, literal: string): Promise<boolean> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "embeddings" ("id","owner_type","owner_id","embedding","model","created_at")
       VALUES (gen_random_uuid()::text, $1, $2, $3::vector, $4, now())
       ON CONFLICT ("owner_type","owner_id")
       DO UPDATE SET "embedding" = EXCLUDED."embedding", "model" = EXCLUDED."model"`,
      ownerType,
      ownerId,
      literal,
      EMBEDDING_MODEL
    );
    return true;
  } catch {
    return false;
  }
}

/** معرّفات مالكي نوع معيّن لهم متجه في الجدول فعلاً (لتخطّيهم في الوضع التزايدي). */
async function ownerIdsWithVector(ownerType: string): Promise<Set<string>> {
  const rows = await prisma.$queryRawUnsafe<Array<{ owner_id: string }>>(
    `SELECT "owner_id" FROM "embeddings" WHERE "owner_type" = $1`,
    ownerType
  ).catch(() => [] as Array<{ owner_id: string }>);
  return new Set(rows.map((r) => r.owner_id));
}

// مواصفة نوع للفهرسة: كيف نعدّه، كيف نصفحه، وكيف نبني نصّ التضمين.
type BackfillSpec = {
  label: string;
  ownerType: string;
  count: () => Promise<number>;
  page: (cursor: string | undefined, take: number) => Promise<Array<{ id: string; text: string }>>;
};

/** فهرسة عامّة لنوع واحد: تزايديّة (تتخطّى ما له متجه) أو كاملة (--all). */
async function backfillType(spec: BackfillSpec, all: boolean, max: number) {
  const existing = all ? new Set<string>() : await ownerIdsWithVector(spec.ownerType);
  const total = await spec.count();
  console.log(
    `${spec.label}: ${total.toLocaleString("ar-SA")} | لها متجه: ${existing.size.toLocaleString("ar-SA")} | النموذج: ${EMBEDDING_MODEL} | البُعد: ${DIM}`
  );

  let processed = 0, updated = 0, failed = 0, skippedDim = 0;
  let cursor: string | undefined;
  while (processed < max) {
    const rows = await spec.page(cursor, BATCH);
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    const pending = all ? rows : rows.filter((r) => !existing.has(r.id));
    if (pending.length) {
      const vectors = await embedBatch(pending.map((r) => r.text));
      for (let i = 0; i < pending.length && processed + i < max; i += 1) {
        const vec = vectors[i] ?? null;
        if (!hasValidDimension(vec, DIM)) { skippedDim += 1; continue; }
        const ok = await upsertVector(spec.ownerType, pending[i].id, buildVectorLiteral(vec));
        ok ? (updated += 1) : (failed += 1);
      }
      await new Promise((r) => setTimeout(r, 250)); // مهلة بسيطة لحدود المعدّل
    }
    processed += rows.length;
    console.log(`  ${spec.label} تقدّم: ${processed.toLocaleString("ar-SA")} | مُحدَّث: ${updated} | متخطّى(بُعد): ${skippedDim} | فشل: ${failed}`);
  }
  console.log(`✓ ${spec.label}: مُحدَّث ${updated.toLocaleString("ar-SA")} | متخطّى(بُعد) ${skippedDim} | فشل ${failed.toLocaleString("ar-SA")}`);
}

async function main() {
  assertAlignmentConfirmed();

  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const limitArg = args.indexOf("--limit");
  const max = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
  const targetArg = args.indexOf("--target");
  const target = targetArg >= 0 ? String(args[targetArg + 1]) : "articles"; // articles|rulings|principles|all

  const keyName = ["EMBEDDING", "API", "KEY"].join("_");
  const fallbackKeyName = ["OPENAI", "API", "KEY"].join("_");
  if (!process.env[keyName] && !process.env[fallbackKeyName]) {
    console.error("✗ لا مفتاح لمزوّد التضمين في البيئة. أوقفت.");
    process.exit(1);
  }

  const specs: Record<string, BackfillSpec> = {
    articles: {
      label: "المواد", ownerType: "article",
      count: () => prisma.legalArticle.count(),
      page: async (cursor, take) => {
        const rows = await prisma.legalArticle.findMany({
          select: { id: true, lawName: true, title: true, content: true, legalSystem: { select: { name: true } } },
          orderBy: { id: "asc" }, take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        return rows.map((r) => ({ id: r.id, text: buildEmbeddingText({ systemName: r.legalSystem?.name ?? r.lawName, title: r.title, content: r.content }) }));
      },
    },
    rulings: {
      label: "الأحكام", ownerType: "ruling",
      count: () => prisma.judicialCase.count(),
      page: async (cursor, take) => {
        const rows = await prisma.judicialCase.findMany({
          select: { id: true, judgmentTitle: true, judgmentText: true, court: true },
          orderBy: { id: "asc" }, take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        return rows.map((r) => ({ id: r.id, text: buildEmbeddingText({ systemName: r.court, title: r.judgmentTitle, content: (r.judgmentText ?? "").slice(0, 8000) }) }));
      },
    },
    principles: {
      label: "المبادئ", ownerType: "principle",
      count: () => prisma.judicialPrinciple.count(),
      page: async (cursor, take) => {
        const rows = await prisma.judicialPrinciple.findMany({
          select: { id: true, title: true, principleText: true },
          orderBy: { id: "asc" }, take, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        return rows.map((r) => ({ id: r.id, text: buildEmbeddingText({ title: r.title, content: r.principleText }) }));
      },
    },
  };

  const targets = target === "all" ? ["articles", "rulings", "principles"] : [target];
  for (const t of targets) {
    const spec = specs[t];
    if (!spec) {
      console.error(`✗ هدف غير معروف: ${t} (المتاح: articles|rulings|principles|all)`);
      process.exit(1);
    }
    await backfillType(spec, all, max);
  }
}

main()
  .catch((e) => {
    console.error("✗ خطأ:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
