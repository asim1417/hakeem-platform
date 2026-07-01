/**
 * backfill-search-norm.ts — يملأ عمود legal_articles.search_norm بنصّ عربي مُطبَّع
 * (نفس normalizeArabicText المستعمل وقت الاستعلام) يجمع: اسم النظام + العنوان + النص +
 * الكلمات المفتاحية + التصنيف + الفصل. أساس الترتيب داخل القاعدة (tsvector + ts_rank_cd).
 *
 * العمود غير مُعرَّف في schema.prisma (مُدار خارج Prisma مثل جدول embeddings)، فنستعمل
 * SQL خام للقراءة والكتابة. آمن للاستئناف: يتخطّى الصفوف المملوءة إلا مع --all.
 *
 * التشغيل (عبر workflow مُقفل فقط — كتابة على القاعدة):
 *   اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 *   npx tsx scripts/backfill-search-norm.ts          # يملأ الفارغ فقط
 *   npx tsx scripts/backfill-search-norm.ts --all     # يعيد بناء الكل
 */
import { prisma } from "@/lib/prisma";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

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

type Row = {
  id: string;
  lawName: string;
  title: string;
  content: string;
  keywords: string[];
  classification: string | null;
  chapter: string | null;
  has: boolean;
};

function buildSearchNorm(a: Row): string {
  const raw = [a.lawName, a.title, a.content, (a.keywords ?? []).join(" "), a.classification ?? "", a.chapter ?? ""]
    .filter(Boolean)
    .join("\n");
  return normalizeArabicText(raw);
}

async function main() {
  assertAlignmentConfirmed();
  const all = process.argv.includes("--all");

  let cursor = "";
  let scanned = 0;
  let updated = 0;
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, "lawName", title, content, keywords, classification, chapter,
              (search_norm IS NOT NULL AND length(search_norm) > 0) AS has
       FROM legal_articles
       WHERE id > $1
       ORDER BY id
       LIMIT ${BATCH}`,
      cursor
    );
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    const pending = all ? rows : rows.filter((r) => !r.has);
    // تحديث دفعي (متوازٍ داخل الدفعة) — كتابة عمود واحد مفهرس.
    await Promise.all(
      pending.map((r) =>
        prisma
          .$executeRawUnsafe(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, r.id, buildSearchNorm(r))
          .then(() => {
            updated += 1;
          })
          .catch(() => {
            /* تجاهل صفّاً واحداً فاشلاً دون كسر الدفعة */
          })
      )
    );
    if (scanned % 2000 === 0 || pending.length) {
      console.log(`… مسح ${scanned.toLocaleString("en-US")} · مُحدَّث ${updated.toLocaleString("en-US")}`);
    }
  }

  const [{ total }] = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    `SELECT count(*)::bigint AS total FROM legal_articles WHERE search_norm IS NOT NULL AND length(search_norm) > 0`
  );
  console.log(`✓ اكتمل. صفوف بعمود search_norm مملوء: ${Number(total).toLocaleString("en-US")} (مسح ${scanned}، مُحدَّث ${updated}).`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("✗ فشل backfill-search-norm:", error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
