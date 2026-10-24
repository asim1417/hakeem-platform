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
import { compileTerm, matchModeLabel, normalizeAr, normSqlExpr, type CompiledTerm, type MatchMode } from "./word-match";

export { normalizeAr };

export const enumerateToolDef = {
  name: "hakeem_enumerate",
  description:
    "حصر شامل (غير مرتَّب دلاليًا) لكل المواد التي يرد فيها لفظ أو أكثر. يرجع العدد الإجمالي، وتوزيعًا حسب النظام، وصفحة نتائج مع cursor للمتابعة. استخدمه للدراسات الحصرية بدل hakeem_search.",
};

/** تعبير التطبيع على نص المادة (مطابق لـ normalizeAr). */
export const NORM_EXPR = normSqlExpr(`a."content"`);
/**
 * التطبيع يُحسب مرة واحدة لكل صف (مراجعة الجودة ٦: كان يُحسب مرتين للتصفية والنمط): LATERAL مع OFFSET 0
 * يمنع المخطِّط من تسطيح الاستعلام الفرعي ونسخ التعبير.
 */
export const NORM_LATERAL = `CROSS JOIN LATERAL (SELECT ${NORM_EXPR} AS n OFFSET 0) nt`;
const NORM_REF = `nt.n`;

/** شرط لفظ واحد على النص المطبَّع (nt.n): تصفية ILIKE ثم نمط حدود الكلمة. يضيف معاملاته إلى params. */
export function termConditionSql(t: CompiledTerm, params: unknown[], normRef = NORM_REF): string {
  params.push(`%${t.literal.replace(/[\\%_]/g, "\\$&")}%`);
  const like = `${normRef} ILIKE $${params.length}`;
  if (!t.regex) return `(${like})`;
  params.push(t.regex);
  return `(${like} AND ${normRef} ~* $${params.length})`;
}

/**
 * شرط WHERE للحصر (يُصدَّر للاختبار، مراجعة الجودة ٥): الألفاظ بـ OR، والصفوف غير المادية مستبعدة،
 * ثم النظام ثم المؤشر. يُستعمل بعد «FROM legal_articles a» و NORM_LATERAL.
 */
export function enumerateWhereSql(compiled: CompiledTerm[], opts: { lawId?: string; cursor?: string }, params: unknown[]): string {
  let w = `(${compiled.map((t) => termConditionSql(t, params)).join(" OR ")}) AND a."articleBis" < ${NON_ARTICLE_BIS}`;
  if (opts.lawId) {
    params.push(opts.lawId);
    w += ` AND a."legalSystemId" = $${params.length}`;
  }
  if (opts.cursor) {
    params.push(opts.cursor);
    w += ` AND a."id" > $${params.length}`;
  }
  return w;
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
  match: {
    mode: MatchMode;
    rule: string;
    terms: string[];
    rejected_terms: string[];
    /** عبارات جاوزت 16 كلمة فطوبق أولها فقط. */
    truncated_terms: string[];
    /** ألفاظ تلتبس بعد التطبيع بكلمة وظيفية («آلية» = «إليه»). */
    ambiguous_terms: Array<{ term: string; with: string[] }>;
  };
  scope: { law_id: string | null; rows: string; exhaustive: true };
  note: string;
}

/** وصف النطاق في الملاحظة: «مدونة حكيم كلها» أو «النظام المحدد كله». */
export function scopePhrase(lawId?: string | null): { name: string; whole: string } {
  return lawId ? { name: "النظام المحدد (law_id)", whole: "النظام المحدد (law_id) كله" } : { name: "مدونة حكيم", whole: "مدونة حكيم كلها" };
}

/** الملاحظة بثلاث حالات: وُجد (كاملًا أو بصفحات)، فُتّش النطاق كله فلم يوجد، أو رُفضت الألفاظ كلها. */
export function enumerateNote(o: {
  total: number;
  hasMore: boolean;
  lawId?: string | null;
  mode: MatchMode;
  rejected: string[];
  truncated?: string[];
  ambiguous?: string[];
}): string {
  const sc = scopePhrase(o.lawId);
  const extra =
    (o.rejected.length ? ` رُفض ${o.rejected.length} لفظ لا حرف فيه ولا رقم.` : "") +
    (o.truncated?.length ? ` قُطعت ${o.truncated.length} عبارة عند 16 كلمة فطوبق أولها فقط.` : "") +
    (o.ambiguous?.length ? ` يلتبس بعد التطبيع بكلمات وظيفية: ${o.ambiguous.join("، ")}، فقد تدخل في النتائج.` : "");
  if (o.total === 0)
    return (
      `فُتّش ${sc.whole} بهذه الألفاظ (${matchModeLabel(o.mode)}) فلم توجد مادة. ` +
      `هذا نفي في هذا النطاق وبهذه الصيغ وحدها، لا نفي للحكم؛ جرّب صيغًا أخرى أو match="derivatives" أو hakeem_search.` +
      extra
    );
  if (o.hasMore) return `total وby_law كاملان في ${sc.whole}؛ الصفحة جزء منها — أعد الاستدعاء بـ cursor حتى يرجع next_cursor فارغًا.${extra}`;
  return `هذه كل المواد المطابقة في ${sc.whole} (${matchModeLabel(o.mode)}).${extra}`;
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
  const truncated = compiled.filter((c) => c.truncated).map((c) => c.term);
  const ambiguous = compiled.filter((c) => c.ambiguous?.length).map((c) => ({ term: c.term, with: c.ambiguous ?? [] }));
  const matchOut = {
    mode,
    rule: matchModeLabel(mode),
    terms: compiled.map((c) => c.term),
    rejected_terms: rejected,
    truncated_terms: truncated,
    ambiguous_terms: ambiguous,
  };
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

  // العدّ الإجمالي والتوزيع حسب النظام (بلا cursor حتى يبقى ثابتًا عبر الصفحات).
  // LEFT JOIN + COALESCE: لا تُسقَط مادة يتيمة (legalSystemId فارغ) — شرط صحّة «الحصر الشامل».
  const countParams: unknown[] = [];
  const countWhere = enumerateWhereSql(compiled, { lawId: args.law_id }, countParams);
  const byLaw = await prisma.$queryRawUnsafe<Array<{ law_id: string | null; law: string; n: bigint }>>(
    `SELECT a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law,
            COUNT(*)::bigint AS n
       FROM "legal_articles" a ${NORM_LATERAL}
       LEFT JOIN "legal_systems" l ON l."id" = a."legalSystemId"
      WHERE ${countWhere}
      GROUP BY a."legalSystemId", COALESCE(l."name", a."lawName")
      ORDER BY n DESC`,
    ...countParams,
  );

  // صفحة النتائج — ترتيب ثابت بالمعرّف (شرط صحّة الـ cursor).
  const pageParams: unknown[] = [];
  const pageWhere = enumerateWhereSql(compiled, { lawId: args.law_id, cursor: args.cursor }, pageParams);
  const rows = await prisma.$queryRawUnsafe<
    Array<{ id: string; article_number: number; law_id: string | null; law: string; content: string }>
  >(
    `SELECT a."id", a."articleNumber" AS article_number, a."legalSystemId" AS law_id,
            COALESCE(l."name", a."lawName") AS law, a."content"
       FROM "legal_articles" a ${NORM_LATERAL}
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
    note: enumerateNote({ total, hasMore, lawId: args.law_id, mode, rejected, truncated, ambiguous: ambiguous.flatMap((a) => a.with) }),
  };
}
