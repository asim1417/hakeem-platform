// ─────────────────────────────────────────────────────────────────────────────
// ResponseVerifier — الحوكمة النهائية على كل ردّ حواري قبل عرضه (المرحلة ٦).
// يفحص: لا استشهاد بلا مصدر أداة · سؤال واحد لا عدّة · لا تكرار لآخر ردّ · لا فراغ.
// دوال نقيّة قابلة للاختبار. الإصلاح الحتمي (تجريد الاستشهاد + سؤال واحد) يُطبَّق دائمًا؛
// حالة التكرار تُعالَج بإعادة توليد واحدة من النموذج في المنسّق.
// ─────────────────────────────────────────────────────────────────────────────
import { jaccardSimilarity } from "./response-composer";
import { stripUnsourcedCitations } from "./policy-gate";

const REPEAT_THRESHOLD = 0.82;

/** عدد الأسئلة في النص (علامات الاستفهام العربية/اللاتينية). */
export function countQuestions(text: string): number {
  return (text.match(/[؟?]/g) ?? []).length;
}

/** يضمن سؤالًا واحدًا كحدّ أقصى: يقصّ عند أول علامة استفهام إن تعدّدت. */
export function enforceSingleQuestion(text: string): string {
  const marks = [...text.matchAll(/[؟?]/g)];
  if (marks.length <= 1) return text;
  const firstEnd = (marks[0].index ?? 0) + 1;
  return text.slice(0, firstEnd).trim();
}

export interface VerifyOptions {
  /** أرقام المواد المسموح الاستشهاد بها (من groundQuery)؛ فارغة في المسار الحواري. */
  allowedArticleNumbers?: Set<number>;
  /** آخر ردود المساعد (لكشف التكرار). */
  recentReplies?: string[];
}

export interface VerifyResult {
  ok: boolean;
  issues: string[];
  /** true إذا كانت المشكلة الوحيدة قابلة للإصلاح بإعادة التوليد (تكرار). */
  repeated: boolean;
}

/** يفحص ردًّا ويُرجع قائمة المشكلات (بلا تعديل). */
export function verifyReply(text: string, opts: VerifyOptions = {}): VerifyResult {
  const issues: string[] = [];
  const t = (text ?? "").trim();
  if (!t) issues.push("empty");
  if (countQuestions(t) > 1) issues.push("multiple_questions");
  if (stripUnsourcedCitations(t, opts.allowedArticleNumbers ?? new Set()).strippedCount > 0) issues.push("unsourced_citation");
  const repeated = (opts.recentReplies ?? []).some((r) => jaccardSimilarity(t, r) > REPEAT_THRESHOLD);
  if (repeated) issues.push("repeated");
  return { ok: issues.length === 0, issues, repeated };
}

/**
 * الإصلاح الحتمي النهائي المطبَّق على كل ردّ حواري: تجريد أي استشهاد غير مُسنَد،
 * ثم فرض سؤال واحد. (التكرار يُعالَج بإعادة توليد في المنسّق، لا هنا.)
 */
export function finalizeReply(text: string, allowedArticleNumbers: Set<number> = new Set()): string {
  const stripped = stripUnsourcedCitations(text ?? "", allowedArticleNumbers).text;
  return enforceSingleQuestion(stripped).trim();
}

/** هل يتكرّر النصّ مع أحد الردود السابقة؟ (لتقرير إعادة التوليد في المنسّق). */
export function isRepeated(text: string, recentReplies: string[] = []): boolean {
  const t = (text ?? "").trim();
  return recentReplies.some((r) => jaccardSimilarity(t, r) > REPEAT_THRESHOLD);
}
