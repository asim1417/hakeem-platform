/**
 * hakeem_enumerate — الحصر الشامل (غير مرتَّب دلاليًا)
 * يرجع «كل» المواد المطابقة للفظ أو عدة ألفاظ، مع عداد إجمالي وتوزيع حسب النظام
 * وترقيم cursor. الحل المباشر لمشكلة top-k: حصر لفظي كامل لا ترتيب دلالي.
 *
 * مُكيَّف على مخطط حكيم الفعلي:
 *   جدول المواد   legal_articles  (a): id, articleNumber, content, legalSystemId, lawName
 *   جدول الأنظمة  legal_systems   (l): id, name
 * الأعمدة camelCase مقتبسة حرفيًّا (Prisma لا يُحوِّلها snake_case ما لم يُعرَّف @map).
 * التطبيع العربي يتمّ داخل SQL ليطابق normalizeAr حرفًا بحرف — فلا حاجة لعمود مُطبَّع.
 */
import { prisma } from "@/lib/prisma";

export const enumerateToolDef = {
  name: "hakeem_enumerate",
  description:
    "حصر شامل (غير مرتَّب دلاليًا) لكل المواد التي تحتوي لفظًا أو أكثر. يرجع العدد الإجمالي، وتوزيعًا حسب النظام، وصفحة نتائج مع cursor للمتابعة. استخدمه للدراسات الحصرية بدل hakeem_search.",
};

/**
 * تطبيع خفيف: توحيد الهمزات والألف المقصورة والتاء المربوطة وإزالة التشكيل.
 * نطاق التشكيل مكتوب بـ \u (U+064B–U+065F + U+0670) — لا يمسّ الأرقام العربية (U+0660+).
 */
export function normalizeAr(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, "") // إزالة التشكيل فقط (دون المساس بالأرقام)
    .replace(/[أإآ]/g, "ا") // أ إ آ → ا
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ة/g, "ه") // ة → ه
    .replace(/ؤ/g, "و") // ؤ → و
    .replace(/ئ/g, "ي"); // ئ → ي
}

// تعبير التطبيع في Postgres — مطابِق تمامًا لـ normalizeAr، عبر translate نقيّ (بلا
// regex، تفاديًا لأي فرق في دعم \u داخل محرّك regex في Postgres): صور الحروف السبعة
// تُبدَّل، وكل حرف تشكيل يقع بعد السبعة في «from» فيتجاوز طول «to» يحذفه translate.
const _VARIANTS_FROM = "أإآىةؤئ"; // أ إ آ ى ة ؤ ئ
const _VARIANTS_TO = "ااايهوي"; // ا ا ا ي ه و ي (٧ مقابل ٧)
const _DIACRITICS =
  Array.from({ length: 0x065f - 0x064b + 1 }, (_, i) => String.fromCharCode(0x064b + i)).join("") + "ٰ";
const NORM_EXPR = `translate(a."content", '${_VARIANTS_FROM}${_DIACRITICS}', '${_VARIANTS_TO}')`;

export interface EnumeratePage {
  article_id: string;
  law: string;
  law_id: string | null;
  article_number: number;
  snippet: string;
  truncated: boolean;
}

export interface EnumerateResult {
  total: number;
  by_law: Array<{ law_id: string | null; law: string; count: number }>;
  page: EnumeratePage[];
  next_cursor: string | null;
  note: string;
}

export async function handleEnumerate(args: {
  terms: string[];
  law_id?: string;
  page_size?: number;
  cursor?: string;
  snippet_len?: number;
}): Promise<EnumerateResult> {
  const pageSize = Math.min(Math.max(args.page_size ?? 25, 1), 50);
  const snip = Math.min(Math.max(args.snippet_len ?? 700, 120), 2000);
  const patterns = args.terms
    .map((t) => normalizeAr((t ?? "").trim()))
    .filter((t) => t.length > 0)
    .map((t) => `%${t}%`);
  if (!patterns.length) {
    return { total: 0, by_law: [], page: [], next_cursor: null, note: "لا ألفاظ صالحة للحصر." };
  }

  const whereTerms = patterns.map((_, i) => `${NORM_EXPR} ILIKE $${i + 1}`).join(" OR ");

  // العدّ الإجمالي والتوزيع حسب النظام (بلا cursor حتى يبقى ثابتًا عبر الصفحات).
  // LEFT JOIN + COALESCE: لا تُسقَط مادة يتيمة (legalSystemId فارغ) — شرط صحّة «الحصر الشامل».
  const countParams: unknown[] = [...patterns];
  let countWhere = `(${whereTerms})`;
  if (args.law_id) {
    countParams.push(args.law_id);
    countWhere += ` AND a."legalSystemId" = $${countParams.length}`;
  }
  const byLaw = await prisma.$queryRawUnsafe<Array<{ law_id: string | null; law: string; n: bigint }>>(
    `SELECT a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law,
            COUNT(*)::bigint AS n
       FROM "legal_articles" a
       LEFT JOIN "legal_systems" l ON l."id" = a."legalSystemId"
      WHERE ${countWhere}
      GROUP BY a."legalSystemId", COALESCE(l."name", a."lawName")
      ORDER BY n DESC`,
    ...countParams,
  );

  // صفحة النتائج — ترتيب ثابت بالمعرّف (شرط صحّة الـ cursor).
  const pageParams: unknown[] = [...patterns];
  let whereExtra = "";
  if (args.law_id) {
    pageParams.push(args.law_id);
    whereExtra += ` AND a."legalSystemId" = $${pageParams.length}`;
  }
  if (args.cursor) {
    pageParams.push(args.cursor);
    whereExtra += ` AND a."id" > $${pageParams.length}`;
  }
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; article_number: number; law_id: string | null; law: string; content: string }>
  >(
    `SELECT a."id", a."articleNumber" AS article_number, a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law, a."content"
       FROM "legal_articles" a
       LEFT JOIN "legal_systems" l ON l."id" = a."legalSystemId"
      WHERE (${whereTerms})${whereExtra}
      ORDER BY a."id" ASC
      LIMIT ${pageSize + 1}`,
    ...pageParams,
  );

  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);
  const total = byLaw.reduce((s, r) => s + Number(r.n), 0);

  return {
    total,
    by_law: byLaw.map((r) => ({ law_id: r.law_id, law: r.law, count: Number(r.n) })),
    page: page.map((r) => ({
      article_id: r.id,
      law: r.law,
      law_id: r.law_id,
      article_number: r.article_number,
      snippet: r.content.length > snip ? r.content.slice(0, snip) + " (...)" : r.content,
      truncated: r.content.length > snip,
    })),
    next_cursor: hasMore ? page[page.length - 1].id : null,
    note: hasMore
      ? "توجد نتائج إضافية — أعد الاستدعاء بـ cursor للمتابعة حتى يرجع next_cursor فارغًا."
      : "هذه كامل النتائج المطابقة.",
  };
}
