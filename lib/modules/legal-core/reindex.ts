// ─────────────────────────────────────────────────────────────────────────────
// إعادة فهرسة بحث النواة — يملأ legal_articles.search_norm (النصّ العربي المُطبَّع الذي
// يعتمده الاسترجاع المفهرس). يُشغَّل من واجهة الإدارة بعد استيراد الأنظمة كي تُطابِق الخدمات
// موادَّ المكتبة. آمنٌ للاستئناف: يملأ الفارغ فقط ما لم يُطلب إعادة بناء الكلّ. نفس منطق backfill CLI.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

const BATCH = 200;

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

export interface ReindexResult { scanned: number; updated: number; total: number; }

/** يضمن وجود عمود search_norm وفهرس GIN (idempotent) — البناء على Vercel يتخطّى الهجرات. */
async function ensureSearchColumn(): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE legal_articles ADD COLUMN IF NOT EXISTS search_norm text`).catch(() => undefined);
  await prisma
    .$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_legal_articles_search_norm_tsv ON legal_articles USING gin (to_tsvector('simple', coalesce(search_norm, '')))`)
    .catch(() => undefined);
}

/** يعيد فهرسة عمود search_norm لكلّ مواد النواة (أو الفارغ فقط). يعيد عدّادات النتيجة. */
export async function reindexSearchNorm(all = false): Promise<ReindexResult> {
  await ensureSearchColumn();
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
    await Promise.all(
      pending.map((r) =>
        prisma
          .$executeRawUnsafe(`UPDATE legal_articles SET search_norm = $2 WHERE id = $1`, r.id, buildSearchNorm(r))
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
