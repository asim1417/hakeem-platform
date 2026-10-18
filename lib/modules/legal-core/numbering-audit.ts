// HKM-028: تدقيق ترقيم المواد بمقارنة رقمها المخزَّن بالعدد الترتيبي المكتوب في عنوانها الرسمي.
// حقلان مستقلّا المصدر: سقوط مادة يُزيح كل ما بعدها فيظهر مقطع إزاحة ثابتة، وهو ما لا يكشفه
// عدّ المواد ولا قيد التفرّد (lawName, articleNumber). مبني على تجربة #631/#652 (انزياح المعاملات المدنية).
// قراءة فقط: يُخرج تشخيصًا لا إصلاحًا. لا يشتق العنوان من الرقم (فيصير الفحص دائريًّا).
import { parseArticleOrdinal } from "../../legal-work/arabic-ordinals";

export interface NumberingRow {
  articleNumber: number;
  title: string | null;
  /**
   * أول سطر من نص المادة (مقطوعًا، لا النص كله). في أنظمة استيراد قديم يكون العنوان رقميًّا
   * مشتقًّا من رقم المادة («المادة 77») والعدد الترتيبي الرسمي مكتوب في أول سطر من المتن
   * («المادة التاسعة والسبعون»)، فيُقرأ منه (الأمر ٠٨، نظام المحاكم التجارية).
   */
  firstLine?: string | null;
}

export interface OffsetRun {
  from: number;
  to: number;
  /** رقم العنوان − الرقم المخزَّن */
  offset: number;
  count: number;
}

export type NumberingStatus = "clean" | "shift" | "irregular" | "no_ordinal_titles";

export interface NumberingAudit {
  articles: number;
  /** عناوين قُرئ منها رقم */
  parsed: number;
  /** الرقم المخزَّن يطابق رقم العنوان */
  matched: number;
  mismatched: number;
  /** عناوين «مكرر» (لا يمثّلها رقم صحيح) */
  bis: number;
  /** مواد قُرئ عددها الترتيبي من أول سطر في المتن لأن عنوانها خالٍ منه أو رقمي */
  fromContent: number;
  /** مواد عنوانها رقمي («المادة 77») بلا عدد ترتيبي مكتوب في المتن: فحصها دائري إن كان العنوان مشتقًّا من الرقم */
  numericTitles: number;
  /** رقم عنوان واحد لأكثر من مادة */
  duplicateTitleNumbers: number[];
  /** أرقام ناقصة بين 1 وأكبر رقم مخزَّن */
  gaps: number[];
  /** مقاطع الإزاحة المتصلة (غير الصفرية) */
  runs: OffsetRun[];
  status: NumberingStatus;
}

/** ترقيم اللوائح «رقم المادة/رقم الفقرة» (مثل «١/٣») ليس عددًا ترتيبيًّا للمادة. */
const ARTICLE_PARAGRAPH = /^\s*[0-9\u0660-\u0669]+\s*\/\s*[0-9\u0660-\u0669]+/;

/** يقرأ رقم العنوان بعد إزالة علامات الترقيم الملتصقة («عشرة:» و«المائتين،»)، فالمحلل لا يزيلها. */
/** عنوان المادة المُعاد ترقيمها: «(المادة الحادية والثلاثون بعد المائتين حالياً) (المادة الأربعون بعد المائتين سابقاً)». */
const CURRENT_NUMBER = /\(([^()]*?)\s*حالي[اًّ]*\s*\)/;

export function titleOrdinal(title: string | null): ReturnType<typeof parseArticleOrdinal> {
  if (!title || ARTICLE_PARAGRAPH.test(title)) return null;
  const current = CURRENT_NUMBER.exec(title)?.[1] ?? title;
  return parseArticleOrdinal(current.replace(/[:：؛;،,.\-–—]+/g, " "));
}

/** عنوان رقمي: «المادة 77» أو «المادة (٧٧)» أو «77» — العدد بالأرقام لا بالكلمات. */
const NUMERIC_TITLE = /^\s*(?:ال)?(?:ماد[ةه])?\s*[(\[]?\s*[0-9\u0660-\u0669\u06F0-\u06F9]+\s*[)\]]?\s*(?:مكرر[اًّ]*(?:\s*(?:مرتين|ثلاث مرات))?)?\s*[:：؛;،,.\-–—]*\s*$/;

export function isNumericTitle(title: string | null | undefined): boolean {
  return !!title && NUMERIC_TITLE.test(title);
}

/** أول سطر في المتن يبدأ بـ«المادة» ثم عدد ترتيبي مكتوب بالكلمات («المادة التاسعة والسبعون:»). */
const CONTENT_ORDINAL_LINE = /^\s*(?:ال)?ماد[ةه]\s+[\u0621-\u064A]/;

export function contentOrdinal(firstLine: string | null | undefined): ReturnType<typeof parseArticleOrdinal> {
  if (!firstLine) return null;
  const line = firstLine.trim();
  if (line.length > 80 || !CONTENT_ORDINAL_LINE.test(line) || /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(line)) return null;
  return titleOrdinal(line);
}

/**
 * مصدر العدد الترتيبي للمادة: العنوان المكتوب بالكلمات أولًا، ثم أول سطر في المتن إن خلا العنوان
 * منه أو كان رقميًّا، ثم العنوان الرقمي (وقد يكون مشتقًّا من الرقم المخزَّن فلا يكشف شيئًا).
 */
export function rowOrdinal(row: NumberingRow): { ordinal: NonNullable<ReturnType<typeof parseArticleOrdinal>>; source: "title" | "content" | "title_numeric" } | null {
  const t = titleOrdinal(row.title);
  const numeric = isNumericTitle(row.title);
  if (t && !numeric) return { ordinal: t, source: "title" };
  const c = contentOrdinal(row.firstLine);
  if (c) return { ordinal: c, source: "content" };
  if (t) return { ordinal: t, source: "title_numeric" };
  return null;
}

/** نسبة العناوين المقروءة التي يُعدّ دونها النظام بلا عناوين ترتيبية. */
const MIN_PARSED_SHARE = 0.5;

export function auditLawNumbering(rows: NumberingRow[]): NumberingAudit {
  const sorted = [...rows].sort((a, b) => a.articleNumber - b.articleNumber);
  const pairs: Array<{ n: number; off: number }> = [];
  const byTitle = new Map<number, number>();
  let parsed = 0;
  let bis = 0;
  let fromContent = 0;
  let numericTitles = 0;
  for (const r of sorted) {
    const ro = rowOrdinal(r);
    if (!ro) continue;
    const o = ro.ordinal;
    parsed++;
    if (ro.source === "content") fromContent++;
    else if (ro.source === "title_numeric") numericTitles++;
    if (o.bis > 0) {
      bis++;
      continue;
    }
    byTitle.set(o.number, (byTitle.get(o.number) ?? 0) + 1);
    pairs.push({ n: r.articleNumber, off: o.number - r.articleNumber });
  }

  const runs: OffsetRun[] = [];
  for (const p of pairs) {
    if (p.off === 0) continue;
    const last = runs[runs.length - 1];
    if (last && last.offset === p.off && p.n === last.to + 1) {
      last.to = p.n;
      last.count++;
    } else runs.push({ from: p.n, to: p.n, offset: p.off, count: 1 });
  }

  const numbers = new Set(sorted.map((r) => r.articleNumber));
  const max = sorted.length ? sorted[sorted.length - 1].articleNumber : 0;
  const gaps: number[] = [];
  for (let n = 1; n <= max; n++) if (!numbers.has(n)) gaps.push(n);

  const mismatched = pairs.filter((p) => p.off !== 0).length;
  const duplicateTitleNumbers = [...byTitle].filter(([, c]) => c > 1).map(([n]) => n).sort((a, b) => a - b);
  const status: NumberingStatus =
    !rows.length || parsed / rows.length < MIN_PARSED_SHARE
      ? "no_ordinal_titles"
      : !mismatched && !duplicateTitleNumbers.length
        ? "clean"
        : runs.some((r) => r.count >= 3)
          ? "shift"
          : "irregular";

  return {
    articles: rows.length,
    parsed,
    matched: pairs.length - mismatched,
    mismatched,
    bis,
    fromContent,
    numericTitles,
    duplicateTitleNumbers,
    gaps,
    runs,
    status,
  };
}
