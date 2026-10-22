/**
 * backfill-search-norm.ts — يملأ عمود legal_articles.search_norm بنصّ عربي مُطبَّع
 * (نفس normalizeArabicText المستعمل وقت الاستعلام) يجمع: اسم النظام + العنوان + النص +
 * الكلمات المفتاحية + التصنيف + الفصل. أساس الترتيب داخل القاعدة (tsvector + ts_rank_cd).
 *
 * HKM-030: المتن المفهرس هو النص الساري (آخر نسخة سارية في unit_version) لا legal_articles.content،
 * بالمصدر الواحد نفسه المستعمل في العرض وفي فهرس BM25 (effective-text)؛ والصفوف التي ليست مواد
 * (درجة «مكرر» ≥ 100: عناوين وجداول ونسخ مكررة) تُستبعد.
 *
 * العمود غير مُعرَّف في schema.prisma (مُدار خارج Prisma مثل جدول embeddings)، فنستعمل
 * SQL خام للقراءة والكتابة. آمن للاستئناف: يتخطّى الصفوف المملوءة إلا مع --all أو --stale.
 *
 * التشغيل (عبر workflow مُقفل فقط — كتابة على القاعدة):
 *   اضبط CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED
 *   npx tsx scripts/backfill-search-norm.ts          # يملأ الفارغ فقط
 *   npx tsx scripts/backfill-search-norm.ts --stale   # الفارغ + ما تغيّر نصه الساري (قيمته المحسوبة تختلف عن المخزونة)
 *   npx tsx scripts/backfill-search-norm.ts --all     # يعيد بناء الكل
 */
import { prisma } from "@/lib/prisma";
import { buildSearchNorm } from "@/lib/modules/legal-core/search-norm";
import { searchableTexts } from "@/lib/modules/legal-core/effective-text";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";

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
  search_norm: string | null;
};

async function main() {
  assertAlignmentConfirmed();
  const all = process.argv.includes("--all");
  const stale = process.argv.includes("--stale");

  let cursor = "";
  let scanned = 0;
  let updated = 0;
  let amended = 0;
  for (;;) {
    const rows = await prisma.$queryRawUnsafe<Row[]>(
      `SELECT id, "lawName", title, content, keywords, classification, chapter, search_norm
       FROM legal_articles
       WHERE id > $1
         AND "articleBis" < ${NON_ARTICLE_BIS}
       ORDER BY id
       LIMIT ${BATCH}`,
      cursor
    );
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;
    scanned += rows.length;

    // النص الساري لكل صف (المصدر الواحد) ثم القيمة المحسوبة.
    const texts = await searchableTexts(rows);
    const computed = rows.map((r) => {
      const content = texts.get(r.id) ?? r.content ?? "";
      if (content !== (r.content ?? "")) amended += 1;
      return { id: r.id, stored: r.search_norm ?? "", norm: buildSearchNorm({ ...r, content }) };
    });
    // الافتراضي: الفارغ فقط. --stale: والمختلف عن القيمة المحسوبة. --all: الكل.
    const pending = computed.filter((c) => all || !c.stored || (stale && c.norm !== c.stored));
    // تحديث دفعي (متوازٍ داخل الدفعة) — كتابة عمود واحد مفهرس.
    await Promise.all(
      pending.map((c) =>
        prisma
          .$executeRawUnsafe(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, c.id, c.norm)
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
  console.log(
    `✓ اكتمل. صفوف بعمود search_norm مملوء: ${Number(total).toLocaleString("en-US")} (مسح ${scanned}، مُحدَّث ${updated}، بنص ساري من unit_version ${amended}).`
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("✗ فشل backfill-search-norm:", error instanceof Error ? error.message : error);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
