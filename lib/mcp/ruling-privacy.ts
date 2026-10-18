/**
 * HKM-012 (الأمر ٠٨، المسار ٣) — حجب أسماء الأفراد والأرقام الشخصية في كل نص حكم يخرج من الموصل.
 *
 * الموصل لا يعرف دور المستخدم، فيُحجب للجميع بقرار المالك (18/10/2026) بالدالة القائمة maskPersonalData
 * (redactPII ثم الأسماء بعد صفة الطرف وسلاسل النسب). أسماء الشركات والجهات وأرقام المواد تبقى.
 *
 * القاعدة: الحجب قبل القص. القصّ من نص خام ثم الحجب يترك نصف اسم على حد المقتطف (صفة الطرف خارج
 * المقتطف والاسم داخله) فلا يلتقطه الحجب. لذا:
 *   - المقتطف والمنطوق يُبنيان من النص المحجوب كاملًا (maskedRulingExcerpts).
 *   - شريحة الجلب بإزاحات النص الخام تُمدّ حدودها إلى فاصل جملة أو سطر قبل حجبها (sentenceSafeBounds).
 * الحجب قاعدي وقد يفوته اسم بلا صفة ولا نسب (انظر mask.ts).
 */
import { maskPersonalData } from "@/lib/rulings/research/mask";
import { buildRulingExcerpts, excerptFrom } from "@/lib/modules/legal-core/ruling-excerpts";

/** نص حكم للعرض في الموصل: أرقام شخصية وأسماء أفراد محجوبة. */
export function maskRulingText(text: string | null | undefined): string {
  return maskPersonalData(text);
}

/**
 * مقتطف ومنطوق من النص المحجوب كاملًا.
 * semanticPart: نوع الجزء الذي طابق بالمعنى (reasons أو disposition…)؛ المقتطف حينها من بداية ذلك الجزء
 * في النص المحجوب، كما يفعل searchRulingsDirect في النص الخام.
 */
export function maskedRulingExcerpts(
  raw: string | null | undefined,
  query: string,
  semanticPart?: string | null,
): { snippet: string; disposition: string | null } {
  const masked = maskPersonalData(raw);
  const ex = buildRulingExcerpts(masked, semanticPart ? "" : query);
  let snippet = ex.snippet;
  if (semanticPart) {
    const part = ex.parts.find((p) => p.type === semanticPart);
    if (part) snippet = excerptFrom(masked, part.start);
  }
  return { snippet, disposition: ex.disposition };
}

/** فواصل لا يعبرها اسم شخص: نهاية سطر أو جملة. */
const SENTENCE_BREAK = /[\n.؛!؟]/;
/** أقصى ما تُمدّ به الحدود بحثًا عن فاصل؛ بعده يُكتفى بحد كلمة. */
export const SAFE_BOUND_REACH = 300;

/**
 * حدود شريحة من النص الخام لا تقسم جملة: النهاية تُمدّ إلى ما بعد أول فاصل جملة، والبداية تُرجع إلى ما بعد
 * آخر فاصل قبلها، ضمن [lo, hi] وبمدى SAFE_BOUND_REACH. إن لم يوجد فاصل فحد كلمة (مسافة).
 * هكذا تبدأ الشريحة التالية (next_offset) من حد جملة أيضًا، فلا ينقسم «المدعي/ فلان» على نداءين.
 */
export function sentenceSafeBounds(full: string, start: number, end: number, lo: number, hi: number): { start: number; end: number } {
  let s = start;
  if (s > lo && !SENTENCE_BREAK.test(full[s - 1] ?? "")) {
    let i = s;
    const floor = Math.max(lo, s - SAFE_BOUND_REACH);
    while (i > floor && !SENTENCE_BREAK.test(full[i - 1])) i--;
    if (i > lo && SENTENCE_BREAK.test(full[i - 1])) s = i;
    else if (i === lo) s = lo;
    else {
      let j = s;
      while (j > floor && !/\s/.test(full[j - 1])) j--;
      s = j;
    }
  }
  let e = end;
  if (e < hi && !SENTENCE_BREAK.test(full[e - 1] ?? "")) {
    let i = e;
    const ceil = Math.min(hi, e + SAFE_BOUND_REACH);
    while (i < ceil && !SENTENCE_BREAK.test(full[i])) i++;
    if (i < hi && SENTENCE_BREAK.test(full[i])) e = i + 1;
    else if (i === hi) e = hi;
    else {
      let j = e;
      while (j < ceil && !/\s/.test(full[j])) j++;
      e = j;
    }
  }
  return { start: s, end: e };
}

const NUMERIC = /[0-9٠-٩\s +\-]/;

/**
 * حدود شريحة الجلب (hakeem_get_ruling) داخل [lo, hi] من إزاحة وطول: حد جملة أولًا (الأسماء)، ثم لا تُقطع
 * داخل رقم (redactPII يحتاج الرقم كاملًا، وإلا تسرّبت هوية أو جوال على نصفين عبر نداءين).
 */
export function safeChunkBounds(full: string, lo: number, hi: number, offset: number, maxChars: number): { start: number; end: number } {
  let start = Math.max(lo, Math.min(lo + offset, hi));
  let end = Math.min(hi, start + maxChars);
  ({ start, end } = sentenceSafeBounds(full, start, end, lo, hi));
  while (start > lo && NUMERIC.test(full[start - 1]) && NUMERIC.test(full[start])) start--;
  while (end < hi && NUMERIC.test(full[end]) && NUMERIC.test(full[end - 1])) end++;
  return { start, end };
}
