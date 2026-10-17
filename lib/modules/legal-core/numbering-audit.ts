// HKM-028: تدقيق ترقيم المواد بمقارنة رقمها المخزَّن بالعدد الترتيبي المكتوب في عنوانها الرسمي.
// حقلان مستقلّا المصدر: سقوط مادة يُزيح كل ما بعدها فيظهر مقطع إزاحة ثابتة، وهو ما لا يكشفه
// عدّ المواد ولا قيد التفرّد (lawName, articleNumber). مبني على تجربة #631/#652 (انزياح المعاملات المدنية).
// قراءة فقط: يُخرج تشخيصًا لا إصلاحًا. لا يشتق العنوان من الرقم (فيصير الفحص دائريًّا).
import { parseArticleOrdinal } from "../../legal-work/arabic-ordinals";

export interface NumberingRow {
  articleNumber: number;
  title: string | null;
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
  /** رقم عنوان واحد لأكثر من مادة */
  duplicateTitleNumbers: number[];
  /** أرقام ناقصة بين 1 وأكبر رقم مخزَّن */
  gaps: number[];
  /** مقاطع الإزاحة المتصلة (غير الصفرية) */
  runs: OffsetRun[];
  status: NumberingStatus;
}

/** نسبة العناوين المقروءة التي يُعدّ دونها النظام بلا عناوين ترتيبية. */
const MIN_PARSED_SHARE = 0.5;

export function auditLawNumbering(rows: NumberingRow[]): NumberingAudit {
  const sorted = [...rows].sort((a, b) => a.articleNumber - b.articleNumber);
  const pairs: Array<{ n: number; off: number }> = [];
  const byTitle = new Map<number, number>();
  let parsed = 0;
  let bis = 0;
  for (const r of sorted) {
    const o = r.title ? parseArticleOrdinal(r.title) : null;
    if (!o) continue;
    parsed++;
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
    duplicateTitleNumbers,
    gaps,
    runs,
    status,
  };
}
