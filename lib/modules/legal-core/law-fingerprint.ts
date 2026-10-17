// HKM-028: بصمة نظام بعد التحقق من مطابقته للمصدر الرسمي، تكشف أي انزياح ترقيم أو تغيّر نص لاحق.
// البصمة لكل مادة: md5 للعنوان كما هو، وmd5 للنص بعد إزالة التشكيل والتطويل والمسافات
// (فلا يُعدّ «موطنًا»/«موطناً» اختلافًا). لا يُحفظ نص المادة في البصمة.
import { createHash } from "node:crypto";

export const FINGERPRINT_NORMALIZATION = "remove [\\u064B-\\u0652\\u0670\\u0640] and all whitespace; md5 hex";

/** [رقم المادة، بصمة العنوان، بصمة النص] */
export type ArticlePrint = [number, string, string];

export interface LawFingerprint {
  lawName: string;
  /** مصدر البصمة ودليل المطابقة. */
  source: string;
  verifiedAt: string;
  normalization: string;
  articles: ArticlePrint[];
}

export interface FingerprintDiff {
  expected: number;
  actual: number;
  missing: number[];
  extra: number[];
  duplicateNumbers: number[];
  titleMismatch: number[];
  textMismatch: number[];
}

const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");

export function normalizeForFingerprint(text: string): string {
  return text.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, "");
}

export function fingerprintArticle(articleNumber: number, title: string, content: string): ArticlePrint {
  return [articleNumber, md5(title), md5(normalizeForFingerprint(content))];
}

export function compareFingerprint(
  expected: ArticlePrint[],
  rows: Array<{ articleNumber: number; title: string; content: string }>,
): FingerprintDiff {
  const want = new Map(expected.map((a) => [a[0], a]));
  const seen = new Map<number, number>();
  const diff: FingerprintDiff = {
    expected: expected.length,
    actual: rows.length,
    missing: [],
    extra: [],
    duplicateNumbers: [],
    titleMismatch: [],
    textMismatch: [],
  };
  for (const r of rows) {
    seen.set(r.articleNumber, (seen.get(r.articleNumber) ?? 0) + 1);
    const w = want.get(r.articleNumber);
    if (!w) {
      diff.extra.push(r.articleNumber);
      continue;
    }
    const [, t, c] = fingerprintArticle(r.articleNumber, r.title, r.content);
    if (t !== w[1]) diff.titleMismatch.push(r.articleNumber);
    if (c !== w[2]) diff.textMismatch.push(r.articleNumber);
  }
  for (const [n, count] of seen) if (count > 1) diff.duplicateNumbers.push(n);
  for (const n of want.keys()) if (!seen.has(n)) diff.missing.push(n);
  for (const k of ["missing", "extra", "duplicateNumbers", "titleMismatch", "textMismatch"] as const) diff[k].sort((a, b) => a - b);
  return diff;
}

export const fingerprintClean = (d: FingerprintDiff) =>
  d.expected === d.actual && !d.missing.length && !d.extra.length && !d.duplicateNumbers.length && !d.titleMismatch.length && !d.textMismatch.length;
