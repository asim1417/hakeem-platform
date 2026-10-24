/**
 * hakeem_enumerate — الحصر الشامل (غير مرتَّب دلاليًا)
 * يرجع «كل» المواد المطابقة للفظ أو عدة ألفاظ، مع عداد إجمالي وتوزيع حسب النظام
 * وترقيم cursor. الحل المباشر لمشكلة top-k: حصر لفظي كامل لا ترتيب دلالي.
 *
 * HKM-044: المطابقة بحدود الكلمة افتراضيًا (word-match.ts): «التعدي» لا تطابق «التعديل». التصفية المسبقة
 * بنمط على النص الخام يكافئ الاحتواء في المطبَّع (rawLiteralPattern) ثم شرط النمط بـ ~* على المطبَّع؛ ووضع contains يبقي الاحتواء القديم صراحةً. الصفوف التي ليست
 * مواد (درجة «مكرر» ≥ 100، HKM-030) لا تُحصر ولا تُعدّ، كما في البحث والنطاق. والملاحظة تقول ما فُتّش وكيف.
 *
 * مُكيَّف على مخطط حكيم الفعلي:
 *   جدول المواد   legal_articles  (a): id, articleNumber, articleBis, content, legalSystemId, lawName
 *   جدول الأنظمة  legal_systems   (l): id, name
 * الأعمدة camelCase مقتبسة حرفيًّا (Prisma لا يُحوِّلها snake_case ما لم يُعرَّف @map).
 * التطبيع العربي يتمّ داخل SQL ليطابق normalizeAr حرفًا بحرف — فلا حاجة لعمود مُطبَّع.
 */
import { prisma } from "@/lib/prisma";
import { isMissingRelation, prismaSqlClient, relationExists, type SqlClient } from "@/lib/modules/legal-core/sql-port";
import { effectiveArticleTexts } from "@/lib/modules/legal-core/effective-text";
import { NON_ARTICLE_BIS } from "@/lib/modules/legal-core/article-key";
import { compileTerm, matchModeLabel, normalizeAr, normSqlExpr, rawLiteralPattern, type CompiledTerm, type MatchMode } from "./word-match";

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

const RAW_REF = `a."content"`;

/**
 * تصفية لفظ مسبقة على النص الخام (rawLiteralPattern): تكافئ «المطبَّع يحوي literal» تمامًا، وتمسّ عمود الجدول وحده،
 * فيدفعها المخطِّط إلى مسح legal_articles ولا يُحسب التطبيع في NORM_LATERAL إلا لما يجتازها.
 */
export function termPrefilterSql(t: CompiledTerm, params: unknown[], rawRef = RAW_REF): string {
  params.push(rawLiteralPattern(t.literal));
  return `${rawRef} ~* $${params.length}`;
}

/** التصفية المسبقة لعدة ألفاظ بينها OR (شرط على العمود وحده، يُضاف بـ AND إلى الشرط الكامل). */
export function anyTermPrefilterSql(ts: CompiledTerm[], params: unknown[], rawRef = RAW_REF): string {
  return `(${ts.map((t) => termPrefilterSql(t, params, rawRef)).join(" OR ")})`;
}

/**
 * شرط لفظ واحد: التصفية المسبقة على الخام ثم نمط حدود الكلمة على المطبَّع (nt.n). يضيف معاملاته إلى params.
 * وضع contains: التصفية وحدها هي الشرط (= ILIKE على المطبَّع).
 */
export function termConditionSql(t: CompiledTerm, params: unknown[], normRef = NORM_REF, rawRef = RAW_REF): string {
  const pre = termPrefilterSql(t, params, rawRef);
  if (!t.regex) return `(${pre})`;
  params.push(t.regex);
  return `(${pre} AND ${normRef} ~* $${params.length})`;
}

// ── النص الساري المعدّل (مراجعة الجودة على 308bdb3، الملاحظة ١) ──
// المادة المعدّلة نصها الساري في unit_version والمحفوظ في legal_articles.content هو الأصلي، فالحصر على المحفوظ وحده
// لا يجد لفظًا لا يرد إلا في النص الساري، ثم يقول «فُتّش فلم يوجد». يُطابَق الشرط نفسه على أحدث نسخة سارية لكل مادة
// (قليلة: نحو 309 في الإنتاج)، وتُضم معرّفاتها إلى الحصر.

/** مراجع الأعمدة للشرط: المحفوظ (a.content ومطبَّعه nt.n) أو النسخة السارية (v.body ومطبَّعها vt.n). */
export interface TextRefs {
  raw: string;
  norm: string;
}
export const STORED_REFS: TextRefs = { raw: RAW_REF, norm: NORM_REF };
export const VERSION_REFS: TextRefs = { raw: "v.body", norm: "vt.n" };

/** أحدث نسخة سارية الآن لكل مادة، مطبَّعةً مرة واحدة (v.body، vt.n). */
export const CURRENT_VERSIONS_FROM = `(SELECT DISTINCT ON (unit_id) unit_id, body FROM unit_version WHERE valid_from <= now() ORDER BY unit_id, valid_from DESC, id DESC) v CROSS JOIN LATERAL (SELECT ${normSqlExpr("v.body")} AS n OFFSET 0) vt`;

let unitVersionKnown: { at: number; ok: boolean } | null = null;
let currentAmendedCache: { at: number; ids: string[] } | null = null;
const UV_CACHE_MS = 5 * 60_000;

async function unitVersionExists(db: SqlClient): Promise<boolean> {
  if (!unitVersionKnown || Date.now() - unitVersionKnown.at > UV_CACHE_MS) {
    unitVersionKnown = { at: Date.now(), ok: await relationExists(db, "unit_version") };
  }
  return unitVersionKnown.ok;
}

/**
 * المواد التي يطابق نصُّها الساري المعدّل الشرطَ (cond مبني بـ VERSION_REFS)، ودرجة كل منها إن مُرّر scoreExpr
 * (عدد المراسي المطابقة في تتبع النص). [] إن لم يوجد الجدول؛ ووجوده يُخزَّن 5 دقائق.
 */
export async function amendedMatches(db: SqlClient, cond: string, params: unknown[], scoreExpr?: string): Promise<Array<{ id: string; score: number }>> {
  if (!(await unitVersionExists(db))) return [];
  try {
    const rows = await db.query<{ id: string; score: number | string }>(
      `SELECT v.unit_id AS id, ${scoreExpr ? `(${scoreExpr})::int` : "1"} AS score FROM ${CURRENT_VERSIONS_FROM} WHERE ${cond}`,
      params,
    );
    return rows.map((r) => ({ id: r.id, score: Number(r.score) }));
  } catch (e) {
    if (isMissingRelation(e)) return [];
    throw e;
  }
}

/** معرّفات المواد التي يطابق نصُّها الساري المعدّل الشرطَ. */
export async function amendedMatchIds(db: SqlClient, cond: string, params: unknown[]): Promise<string[]> {
  return (await amendedMatches(db, cond, params)).map((r) => r.id);
}

/** كل المواد التي لها نسخة سارية الآن (نحو 700 في الإنتاج)، مخزَّنة 5 دقائق. */
export async function currentlyAmendedIds(db: SqlClient): Promise<string[]> {
  if (currentAmendedCache && Date.now() - currentAmendedCache.at < UV_CACHE_MS) return currentAmendedCache.ids;
  if (!(await unitVersionExists(db))) return [];
  const rows = await db.query<{ id: string }>(`SELECT DISTINCT unit_id AS id FROM unit_version WHERE valid_from <= now()`);
  currentAmendedCache = { at: Date.now(), ids: rows.map((r) => r.id) };
  return currentAmendedCache.ids;
}

/** للاختبارات: يُسقط ما خُزّن عن unit_version. */
export function resetUnitVersionCache(): void {
  unitVersionKnown = null;
  currentAmendedCache = null;
}

/**
 * يضمّ مطابقات النص الساري إلى شرط المحفوظ دون أن يفقد دفع التصفية إلى المسح: (تصفية الخام أو المعرّف) و(الشرط أو المعرّف).
 * pre = تصفية على a.content وحده (أو null)، full = الشرط الكامل.
 */
export function withAmendedIds(pre: string | null, full: string, ids: string[], params: unknown[]): string {
  if (!ids.length) return pre ? `${pre} AND ${full}` : full;
  params.push(ids);
  const v = `a."id" = ANY($${params.length}::text[])`;
  return `(${pre ?? "TRUE"} OR ${v}) AND (${full} OR ${v})`;
}

/**
 * النص الساري وحده للمادة المعدّلة (للمنطقي: النفي على النص القديم يُرجع مادة نصُّها اليوم يحوي المنفي — مراجعة الجودة
 * على d11bc97): المادة المعدّلة تُقبل بمطابقة ساريها وحده، وغير المعدّلة بمحفوظها. التصفية على الخام تبقى مدفوعة إلى المسح.
 */
export function withCurrentTextOnly(pre: string | null, full: string, matched: string[], allAmended: string[], params: unknown[]): string {
  if (!allAmended.length) return withAmendedIds(pre, full, matched, params);
  params.push(allAmended);
  const amended = `a."id" = ANY($${params.length}::text[])`;
  if (!matched.length) return `${pre ? `${pre} AND ` : ""}NOT ${amended} AND ${full}`;
  params.push(matched);
  const v = `a."id" = ANY($${params.length}::text[])`;
  return `(${pre ?? "TRUE"} OR ${v}) AND ((NOT ${amended} AND ${full}) OR ${v})`;
}

/**
 * شرط WHERE للحصر (يُصدَّر للاختبار، مراجعة الجودة ٥): الألفاظ بـ OR، والصفوف غير المادية مستبعدة،
 * ثم النظام ثم المؤشر. يُستعمل بعد «FROM legal_articles a» و NORM_LATERAL. تصفية OR على الخام تُقدَّم شرطًا مستقلًّا
 * (OR الشروط الكاملة لا يُدفع إلى المسح لأنه يمسّ nt)، وamendedIds مواد طابق نصُّها الساري المعدّل.
 */
export function enumerateWhereSql(
  compiled: CompiledTerm[],
  opts: { lawId?: string; cursor?: string; amendedIds?: string[] },
  params: unknown[],
): string {
  const full = `(${compiled.map((t) => termConditionSql(t, params)).join(" OR ")})`;
  const pre = compiled.length > 1 || opts.amendedIds?.length ? anyTermPrefilterSql(compiled, params) : null;
  let w = `${withAmendedIds(pre, full, opts.amendedIds ?? [], params)} AND a."articleBis" < ${NON_ARTICLE_BIS}`;
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
  const scope = { law_id: args.law_id ?? null, rows: "مواد الأنظمة واللوائح: النص المحفوظ والنص الساري المعدّل (بلا الصفوف غير المادية)", exhaustive: true as const };
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

  // المواد التي يطابق نصُّها الساري المعدّل (يُضم إلى الحصر؛ الصفحة تعرض النص الساري دائمًا).
  const vParams: unknown[] = [];
  const amendedIds = await amendedMatchIds(
    prismaSqlClient(prisma),
    `(${compiled.map((t) => termConditionSql(t, vParams, VERSION_REFS.norm, VERSION_REFS.raw)).join(" OR ")})`,
    vParams,
  );

  // العدّ الإجمالي والتوزيع حسب النظام (بلا cursor حتى يبقى ثابتًا عبر الصفحات).
  // LEFT JOIN + COALESCE: لا تُسقَط مادة يتيمة (legalSystemId فارغ) — شرط صحّة «الحصر الشامل».
  const countParams: unknown[] = [];
  const countWhere = enumerateWhereSql(compiled, { lawId: args.law_id, amendedIds }, countParams);
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
  const pageWhere = enumerateWhereSql(compiled, { lawId: args.law_id, cursor: args.cursor, amendedIds }, pageParams);
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
        // الحصر على المحفوظ والساري معًا؛ في المعدّلة قد يكون اللفظ في أحدهما وحده.
        amended: e?.source === "unit_version",
      };
    }),
    next_cursor: hasMore ? page[page.length - 1].id : null,
    match: matchOut,
    scope,
    note: enumerateNote({ total, hasMore, lawId: args.law_id, mode, rejected, truncated, ambiguous: ambiguous.flatMap((a) => a.with) }),
  };
}
