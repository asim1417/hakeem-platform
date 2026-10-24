/**
 * hakeem_enumerate — الحصر الشامل (غير مرتَّب دلاليًا)
 * يرجع «كل» المواد المطابقة للفظ أو عدة ألفاظ، مع عداد إجمالي وتوزيع حسب النظام
 * وترقيم cursor. الحل المباشر لمشكلة top-k: حصر لفظي كامل لا ترتيب دلالي.
 *
 * HKM-044: المطابقة بحدود الكلمة افتراضيًا (word-match.ts): «التعدي» لا تطابق «التعديل». التصفية المسبقة
 * بـ ILIKE على النص المطبَّع ثم شرط النمط بـ ~*؛ ووضع contains يبقي الاحتواء القديم صراحةً. الصفوف التي ليست
 * مواد (درجة «مكرر» ≥ 100، HKM-030) لا تُحصر ولا تُعدّ، كما في البحث والنطاق. والملاحظة تقول ما فُتّش وكيف.
 *
 * مُكيَّف على مخطط حكيم الفعلي:
 *   جدول المواد   legal_articles  (a): id, articleNumber, articleBis, content, legalSystemId, lawName
 *   جدول الأنظمة  legal_systems   (l): id, name
 * الأعمدة camelCase مقتبسة حرفيًّا (Prisma لا يُحوِّلها snake_case ما لم يُعرَّف @map).
 * التطبيع العربي يتمّ داخل SQL ليطابق normalizeAr حرفًا بحرف — فلا حاجة لعمود مُطبَّع.
 */
import { prisma } from "@/lib/prisma";
import { effectiveArticleTexts } from "@/lib/modules/legal-core/effective-text";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";
import { compileTerm, matchModeLabel, normalizeAr, type CompiledTerm, type MatchMode } from "./word-match";

export { normalizeAr };

export const enumerateToolDef = {
  name: "hakeem_enumerate",
  description:
    "حصر شامل (غير مرتَّب دلاليًا) لكل المواد التي يرد فيها لفظ أو أكثر. يرجع العدد الإجمالي، وتوزيعًا حسب النظام، وصفحة نتائج مع cursor للمتابعة. استخدمه للدراسات الحصرية بدل hakeem_search.",
};

// تعبير التطبيع في Postgres — مطابِق تمامًا لـ normalizeAr، عبر translate نقيّ: صور الحروف الثمانية
// تُبدَّل، وكل حرف تشكيل أو تطويل يقع بعدها في «from» فيتجاوز طول «to» يحذفه translate.
const _VARIANTS_FROM = "أإآٱىةؤئ"; // أ إ آ ٱ ى ة ؤ ئ
const _VARIANTS_TO = "اااايهوي"; // ا ا ا ا ي ه و ي (٨ مقابل ٨)
const _DIACRITICS =
  Array.from({ length: 0x065f - 0x064b + 1 }, (_, i) => String.fromCharCode(0x064b + i)).join("") + "ٰ" + "ـ";
export const NORM_EXPR = `translate(a."content", '${_VARIANTS_FROM}${_DIACRITICS}', '${_VARIANTS_TO}')`;

/** شرط لفظ واحد على النص المطبَّع: تصفية ILIKE ثم نمط حدود الكلمة. يضيف معاملاته إلى params. */
export function termConditionSql(t: CompiledTerm, params: unknown[]): string {
  params.push(`%${t.literal.replace(/[\\%_]/g, "\\$&")}%`);
  const like = `${NORM_EXPR} ILIKE $${params.length}`;
  if (!t.regex) return `(${like})`;
  params.push(t.regex);
  return `(${like} AND ${NORM_EXPR} ~* $${params.length})`;
}

export interface EnumeratePage {
  article_id: string;
  law: string;
  law_id: string | null;
  article_number: number;
  snippet: string;
  truncated: boolean;
  repealed: boolean;
  amended: boolean;
}

export interface EnumerateResult {
  total: number;
  by_law: Array<{ law_id: string | null; law: string; count: number }>;
  page: EnumeratePage[];
  next_cursor: string | null;
  /** HKM-044: طريقة المطابقة وما فُتّش. */
  match: { mode: MatchMode; rule: string; terms: string[]; rejected_terms: string[] };
  scope: { law_id: string | null; rows: string; exhaustive: true };
  note: string;
}

/** الملاحظة بثلاث حالات: وُجد (كاملًا أو بصفحات)، فُتّش النطاق كله فلم يوجد، أو رُفضت الألفاظ كلها. */
export function enumerateNote(o: { total: number; hasMore: boolean; scopeLabel: string; mode: MatchMode; rejected: string[] }): string {
  const rej = o.rejected.length ? ` ورُفض ${o.rejected.length} لفظ لا حرف فيه ولا رقم.` : "";
  if (o.total === 0)
    return (
      `فُتّش ${o.scopeLabel} كله بهذه الألفاظ (${matchModeLabel(o.mode)}) فلم توجد مادة. ` +
      `هذا نفي في هذا النطاق وبهذه الصيغ وحدها، لا نفي للحكم؛ جرّب صيغًا أخرى أو match="derivatives" أو hakeem_search.` +
      rej
    );
  if (o.hasMore)
    return `total وby_law كاملان لـ${o.scopeLabel}؛ الصفحة جزء منها — أعد الاستدعاء بـ cursor حتى يرجع next_cursor فارغًا.${rej}`;
  return `هذه كل المواد المطابقة في ${o.scopeLabel} (${matchModeLabel(o.mode)}).${rej}`;
}

export async function handleEnumerate(args: {
  terms: string[];
  law_id?: string;
  page_size?: number;
  cursor?: string;
  snippet_len?: number;
  match?: MatchMode;
}): Promise<EnumerateResult> {
  const mode: MatchMode = args.match ?? "word";
  const pageSize = Math.min(Math.max(args.page_size ?? 25, 1), 50);
  const snip = Math.min(Math.max(args.snippet_len ?? 700, 120), 2000);
  const compiled: CompiledTerm[] = [];
  const rejected: string[] = [];
  for (const t of args.terms ?? []) {
    const c = compileTerm(t, mode);
    if (c) compiled.push(c);
    else rejected.push(String(t ?? ""));
  }
  const scopeLabel = args.law_id ? "النظام المحدد (law_id)" : "مدونة حكيم كلها";
  const matchOut = { mode, rule: matchModeLabel(mode), terms: compiled.map((c) => c.term), rejected_terms: rejected };
  const scope = { law_id: args.law_id ?? null, rows: "مواد الأنظمة واللوائح (بلا الصفوف غير المادية)", exhaustive: true as const };
  if (!compiled.length) {
    return {
      total: 0,
      by_law: [],
      page: [],
      next_cursor: null,
      match: matchOut,
      scope,
      note: "رُفضت الألفاظ كلها: لا حرف فيها ولا رقم، فلم يُفتَّش شيء. هذا ليس نفيًا.",
    };
  }

  const where = (params: unknown[]): string => {
    let w = `(${compiled.map((t) => termConditionSql(t, params)).join(" OR ")}) AND a."articleBis" < ${NON_ARTICLE_BIS}`;
    if (args.law_id) {
      params.push(args.law_id);
      w += ` AND a."legalSystemId" = $${params.length}`;
    }
    return w;
  };

  // العدّ الإجمالي والتوزيع حسب النظام (بلا cursor حتى يبقى ثابتًا عبر الصفحات).
  // LEFT JOIN + COALESCE: لا تُسقَط مادة يتيمة (legalSystemId فارغ) — شرط صحّة «الحصر الشامل».
  const countParams: unknown[] = [];
  const countWhere = where(countParams);
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
  const pageParams: unknown[] = [];
  let pageWhere = where(pageParams);
  if (args.cursor) {
    pageParams.push(args.cursor);
    pageWhere += ` AND a."id" > $${pageParams.length}`;
  }
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; article_number: number; law_id: string | null; law: string; content: string }>
  >(
    `SELECT a."id", a."articleNumber" AS article_number, a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law, a."content"
       FROM "legal_articles" a
       LEFT JOIN "legal_systems" l ON l."id" = a."legalSystemId"
      WHERE ${pageWhere}
      ORDER BY a."id" ASC
      LIMIT ${pageSize + 1}`,
    ...pageParams,
  );

  const hasMore = rows.length > pageSize;
  const page = rows.slice(0, pageSize);
  const total = byLaw.reduce((s, r) => s + Number(r.n), 0);
  // الحصر يطابق النص المحفوظ؛ المعروض هو النص الساري (المصدر الواحد).
  const effective = await effectiveArticleTexts(page);

  return {
    total,
    by_law: byLaw.map((r) => ({ law_id: r.law_id, law: r.law, count: Number(r.n) })),
    page: page.map((r) => {
      const e = effective.get(r.id);
      const text = e?.text ?? r.content;
      return {
        article_id: r.id,
        law: r.law,
        law_id: r.law_id,
        article_number: r.article_number,
        snippet: text.length > snip ? text.slice(0, snip) + " (...)" : text,
        truncated: text.length > snip,
        repealed: e?.repealed ?? false,
        // طابق الحصر النص الأصلي والنص الساري معدّل: قد لا يحوي اللفظ.
        amended: e?.source === "unit_version",
      };
    }),
    next_cursor: hasMore ? page[page.length - 1].id : null,
    match: matchOut,
    scope,
    note: enumerateNote({ total, hasMore, scopeLabel, mode, rejected }),
  };
}
