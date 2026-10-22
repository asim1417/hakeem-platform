// ─────────────────────────────────────────────────────────────────────────────
// إعادة فهرسة بحث النواة — يملأ legal_articles.search_norm (النصّ العربي المُطبَّع الذي
// يعتمده الاسترجاع المفهرس). يُشغَّل من واجهة الإدارة بعد استيراد الأنظمة كي تُطابِق الخدمات
// موادَّ المكتبة. آمنٌ للاستئناف: يملأ الفارغ فقط ما لم يُطلب إعادة بناء الكلّ أو المتغيّر فقط.
// نفس منطق backfill CLI.
// HKM-030: المتن المفهرس هو النص الساري (unit_version) بالمصدر الواحد (effective-text)، والصفوف
// التي ليست مواد (درجة «مكرر» ≥ 100) تُستبعد.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { buildSearchNorm } from "@/lib/modules/legal-core/search-norm";
import { searchableTexts } from "@/lib/modules/legal-core/effective-text";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";

const BATCH = 200;

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

export interface ReindexResult { scanned: number; updated: number; total: number; }

/** نطاق إعادة الفهرسة: الفارغ فقط (false)، أو الكل (true)، أو الفارغ والمختلف عن القيمة المحسوبة ("stale"). */
export type ReindexScope = boolean | "stale";

/** يضمن وجود عمود search_norm وفهرس GIN (idempotent) — البناء على Vercel يتخطّى الهجرات. */
async function ensureSearchColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE legal_articles ADD COLUMN IF NOT EXISTS search_norm text`).catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_legal_articles_search_norm_tsv ON legal_articles USING gin (to_tsvector('simple', coalesce(search_norm, '')))`)
    .catch(() => undefined);
}

/** يعيد فهرسة عمود search_norm لمواد النواة (الفارغ فقط، أو الكل، أو المتغيّر). يعيد عدّادات النتيجة. */
export async function reindexSearchNorm(scope: ReindexScope = false): Promise<ReindexResult> {
  await ensureSearchColumn();
  const all = scope === true;
  const stale = scope === "stale";
  let cursor = "";
  let scanned = 0;
  let updated = 0;
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
    const texts = await searchableTexts(rows);
    const computed = rows.map((r) => ({
      id: r.id,
      stored: r.search_norm ?? "",
      norm: buildSearchNorm({ ...r, content: texts.get(r.id) ?? r.content ?? "" }),
    }));
    const pending = computed.filter((c) => all || !c.stored || (stale && c.norm !== c.stored));
    await Promise.all(
      pending.map((c) =>
        prisma
          .$executeRawUnsafe(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, c.id, c.norm)
          .then(() => { updated += 1; })
          .catch(() => { /* تجاهل صفّاً فاشلاً دون كسر الدفعة */ })
      )
    );
  }
  const totalRows = await prisma.$queryRawUnsafe<Array<{ total: bigint }>>(
    `SELECT count(*)::bigint AS total FROM legal_articles WHERE search_norm IS NOT NULL AND length(search_norm) > 0`
  ).catch(() => [{ total: BigInt(0) }]);
  return { scanned, updated, total: Number(totalRows[0]?.total ?? 0) };
}
