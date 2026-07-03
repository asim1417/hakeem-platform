/**
 * verify-search-index.ts — تحقّق تجريبيّ (قراءة فقط) من استخدام فهرس البحث الفعليّ.
 * يُشغّل EXPLAIN (ANALYZE, BUFFERS) على:
 *   (أ) استعلام الإنتاج الحاليّ: to_tsvector('simple', search_norm)  — بلا coalesce
 *   (ب) النسخة المُطابِقة للفهرس: to_tsvector('simple', coalesce(search_norm,''))
 * ويطبع الخطّتين + تعريف الفهارس، ليقرّر: هل يستخدم الاستعلام الفهرس (Bitmap Index Scan)
 * أم يمسح الجدول (Seq Scan)؟ EXPLAIN ANALYZE يُنفّذ SELECT فقط — لا كتابة.
 */
import { prisma } from "@/lib/prisma";

const TERM = process.env.VERIFY_TERM || "التحكيم"; // كلمة اختبار (شكل الخطّة لا يتغيّر بالكلمة)

async function explain(label: string, tsvecExpr: string) {
  const sql =
    `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ` +
    `SELECT id FROM legal_articles ` +
    `WHERE search_norm IS NOT NULL AND ${tsvecExpr} @@ to_tsquery('simple', $1) ` +
    `ORDER BY ts_rank_cd(${tsvecExpr}, to_tsquery('simple', $1)) DESC LIMIT 40`;
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(sql, TERM);
  const plan = rows.map((r) => Object.values(r)[0]).join("\n");
  const usesIndex = /Index Scan|Bitmap Index Scan/i.test(plan);
  const seqScan = /Seq Scan/i.test(plan);
  console.log(`\n═══ ${label} ═══`);
  console.log(plan);
  console.log(`⇒ يستخدم فهرسًا: ${usesIndex ? "نعم ✅" : "لا"} · مسح تسلسليّ: ${seqScan ? "نعم ⚠️" : "لا"}`);
  return { usesIndex, seqScan };
}

async function main() {
  console.log("تحقّق فهرس البحث (EXPLAIN ANALYZE، قراءة فقط) · كلمة:", TERM);
  const idx = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename='legal_articles' AND indexname LIKE 'idx_legal_articles_search_norm%'`
  );
  console.log("\nالفهارس الموجودة على search_norm:");
  for (const i of idx) console.log(`  • ${i.indexname}: ${i.indexdef}`);
  if (!idx.length) console.log("  (لا فهرس search_norm — شغّل build-search-vector أولًا)");

  const current = await explain("(أ) استعلام الإنتاج الحاليّ — بلا coalesce", "to_tsvector('simple', search_norm)");
  const aligned = await explain("(ب) المُطابِق للفهرس — بـ coalesce", "to_tsvector('simple', coalesce(search_norm, ''))");

  console.log("\n═══ الحكم ═══");
  if (!current.usesIndex && aligned.usesIndex) {
    console.log("مؤكَّد: استعلام الإنتاج لا يستخدم الفهرس (مسح تسلسليّ)، بينما نسخة coalesce تستخدمه.");
    console.log("⇒ الإصلاح صحيح: وحِّد التعبير على coalesce(search_norm,'') في الاستعلام.");
  } else if (current.usesIndex) {
    console.log("استعلام الإنتاج يستخدم الفهرس فعلًا — لا حاجة لتعديل coalesce (يُلغى هذا البند).");
  } else {
    console.log("كلاهما لا يستخدم الفهرس — تحقّق من وجود الفهرس/حجم الجدول (قد يفضّل المُخطِّط المسح لصغر الجدول).");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });
