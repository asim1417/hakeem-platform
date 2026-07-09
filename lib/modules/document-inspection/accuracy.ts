// قياس دقّة الاستخراج — CER/WER — نواة محايدة البيئة (متصفح + خادم).
//
// الغرض (وفق التقرير التقني §3): لا يمكن ادّعاء الصدارة في الدقّة بلا رقمٍ مُقاس.
// هذه الوحدة تقيس نصّ المخرَج مقابل «الحقيقة» المُدقَّقة يدوياً بمقياسين معياريين:
//   CER — Character Error Rate: مسافة التحرير على الأحرف ÷ أحرف الحقيقة.
//   WER — Word  Error Rate:    مسافة التحرير على الكلمات ÷ كلمات الحقيقة.
// كلاهما 0 = مطابقة تامّة، والأصغر أفضل. تُقاس على مجموعة ذهبية من وثائق حقيقية.
//
// كل الدوال نقيّة وحتمية: لا شبكة ولا حالة. تُستعمل في المتصفح (عرض جودة للمستخدم)
// وفي الخادم (مقارنة محرّكات: محلّي/Gemini/QARI على مجموعة ذهبية).

import { normStr } from "./search";

/**
 * مسافة تحرير Levenshtein على متتالية عامّة (أحرف أو كلمات). تحسينُ صفّين يخفض
 * الذاكرة إلى O(min) — يكفي لوثائق بآلاف الأحرف. الإدراج/الحذف/الاستبدال بتكلفة 1.
 */
export function editDistance<T>(a: T[], b: T[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // اجعل b الأقصر لتقليل الذاكرة
  if (b.length > a.length) [a, b] = [b, a];
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** يقسم النص إلى كلمات (فراغات) بعد قصّ الأطراف. */
function words(text: string): string[] {
  return (text ?? "").trim().split(/\s+/).filter(Boolean);
}

export interface AccuracyReport {
  /** معدّل خطأ الأحرف [0..∞) — 0 مطابقة تامّة. */
  cer: number;
  /** معدّل خطأ الكلمات [0..∞) — 0 مطابقة تامّة. */
  wer: number;
  /** دقّة الأحرف % = (1 − cer) مقصوصة عند 0. */
  charAccuracy: number;
  /** عدد أحرف الحقيقة (المقام). */
  refChars: number;
  /** عدد كلمات الحقيقة (المقام). */
  refWords: number;
}

/**
 * يقيس دقّة المخرَج مقابل الحقيقة. الوضع الافتراضي حرفيّ صارم. مرّر normalize=true
 * لتجاهل فروق التشكيل والهمزات (تطبيع البحث) — للحكم على «صحّة المحتوى» لا شكله.
 */
export function measureAccuracy(reference: string, hypothesis: string, opts?: { normalize?: boolean }): AccuracyReport {
  let ref = reference ?? "";
  let hyp = hypothesis ?? "";
  if (opts?.normalize) {
    ref = normStr(ref);
    hyp = normStr(hyp);
  }
  const refCharArr = Array.from(ref);
  const hypCharArr = Array.from(hyp);
  const refWordArr = words(ref);
  const hypWordArr = words(hyp);

  const refChars = refCharArr.length;
  const refWords = refWordArr.length;
  const cer = refChars === 0 ? (hypCharArr.length === 0 ? 0 : 1) : editDistance(refCharArr, hypCharArr) / refChars;
  const wer = refWords === 0 ? (hypWordArr.length === 0 ? 0 : 1) : editDistance(refWordArr, hypWordArr) / refWords;

  return {
    cer,
    wer,
    charAccuracy: Math.max(0, 1 - cer),
    refChars,
    refWords
  };
}

/** صيغة نسبة مئوية موجزة للعرض (مثل «94.2٪»). */
export function formatAccuracy(report: AccuracyReport): string {
  return (report.charAccuracy * 100).toFixed(1) + "٪";
}
