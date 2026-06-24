/**
 * principle-extractor.ts — استخراج المبدأ القضائي (الـ headnote) من نصّ الحكم.
 *
 * مبدأ أساسي: **لا اختلاق**. يُستخرج المبدأ فقط من نصّ الحكم نفسه:
 *   - إمّا عبر عُنونة صريحة («المبدأ:» / «القاعدة:» / «الخلاصة:»)،
 *   - أو عبر الفقرة الافتتاحية المقتضبة التي تسبق سرد الوقائع (نمط شائع في
 *     مجاميع الأحكام السعودية حيث يتصدّر المبدأ نصّ الحكم).
 * إن تعذّر استخراج مبدأ موثوق، تُعاد null (يُترك للاستخراج بالذكاء لاحقًا).
 *
 * المخرجات تُوسم دائمًا بـ reviewStatus="needs_review" في طبقة الكتابة،
 * فالاستخراج الآلي اقتراح يخضع للمراجعة لا حقيقة نهائية.
 */

import { normalizeDigits } from "./decree-extractor";

export interface ExtractedPrinciple {
  title: string;
  principleText: string;
  /** طريقة الاستخراج — للشفافية في المراجعة */
  method: "labeled" | "headnote";
  /** ثقة تقديرية 0..1 */
  confidence: number;
}

// عُنونات صريحة للمبدأ داخل الحكم.
const LABELS = ["المبدأ القضائي", "المبدأ", "القاعدة القضائية", "القاعدة", "الخلاصة"];

// علامات بداية سرد الوقائع/الإجراءات — المبدأ ينتهي قبلها.
const FACT_MARKERS = [
  "تتلخص وقائع",
  "وتتلخص الوقائع",
  "الوقائع",
  "وبعد الاطلاع",
  "بعد الاطلاع",
  "أقام المدعي",
  "تقدم المدعي",
  "حيث إن",
  "وحيث إن",
];

function clean(s: string): string {
  return normalizeDigits(s)
    .replace(/\s+/g, " ")
    .replace(/^[\s:،.\-—()]+/, "")
    .trim();
}

function firstSentence(text: string, max = 120): string {
  const stop = text.search(/[.،؛\n]/);
  const head = stop > 12 ? text.slice(0, stop) : text.slice(0, max);
  return head.trim();
}

function indexOfAny(text: string, needles: string[]): number {
  let best = -1;
  for (const n of needles) {
    const i = text.indexOf(n);
    if (i !== -1 && (best === -1 || i < best)) best = i;
  }
  return best;
}

/**
 * يستخرج المبدأ القضائي من نصّ الحكم. `fallbackTitle` يُستخدم للعنوان
 * إذا كان المبدأ بلا جملة افتتاحية واضحة.
 */
export function extractPrinciple(
  judgmentText: string | null | undefined,
  fallbackTitle?: string | null
): ExtractedPrinciple | null {
  if (!judgmentText) return null;
  const text = normalizeDigits(String(judgmentText)).trim();
  if (text.length < 40) return null;

  // (1) عُنونة صريحة: «المبدأ: ...»
  for (const label of LABELS) {
    const re = new RegExp(`${label}\\s*[:：\\-—]\\s*`);
    const m = re.exec(text);
    if (m) {
      const start = m.index + m[0].length;
      const rest = text.slice(start);
      const factIdx = indexOfAny(rest, FACT_MARKERS);
      const slice = clean(factIdx > 30 ? rest.slice(0, factIdx) : rest.slice(0, 600));
      if (slice.length >= 30) {
        const title = clean(fallbackTitle || firstSentence(slice));
        return {
          title: title || "مبدأ قضائي",
          principleText: slice.slice(0, 1200),
          method: "labeled",
          confidence: 0.85,
        };
      }
    }
  }

  // (2) headnote افتتاحي: الفقرة قبل أول علامة وقائع، إن كانت مقتضبة ومعقولة.
  const factIdx = indexOfAny(text, FACT_MARKERS);
  if (factIdx >= 40 && factIdx <= 700) {
    const slice = clean(text.slice(0, factIdx));
    // headnote حقيقي عادةً جملة أو جملتان لا مقدمة شكلية ولا بيانات تعريفية للقضية.
    if (slice.length >= 40 && slice.length <= 700 && !/^(?:بسم|الحمد|إن مجلس|إن المحكمة)/.test(slice) && !isMetadataText(slice)) {
      const title = clean(fallbackTitle || firstSentence(slice));
      return {
        title: title || "مبدأ قضائي",
        principleText: slice.slice(0, 1200),
        method: "headnote",
        confidence: 0.6,
      };
    }
  }

  return null;
}

// نصّ تعريفي للقضية لا مبدأ: «القضية رقم … لعام …هـ»، أرقام/قرارات صرفة.
function isMetadataText(s: string): boolean {
  const t = s.trim();
  if (/^(?:القضية|الدعوى|القرار|الحكم|قضية|الاستئناف)\s*رقم/.test(t)) return true;
  if (/^رقم\s+\d/.test(t)) return true;
  // نسبة الأحرف العربية منخفضة (غالبه أرقام/تواريخ).
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  if (letters < t.length * 0.4) return true;
  return false;
}

/**
 * يصنّف مبدأً مخزّنًا كـ«غير صالح» (لا يمثّل مبدأً قضائيًا فعليًا) للمراجعة الآلية.
 * يُستخدم في الفرز (triage) لرفض المخرجات الضعيفة دون اعتماد بشري للجيّد.
 */
export function isJunkPrinciple(title: string | null | undefined, principleText: string | null | undefined): boolean {
  const text = clean(String(principleText ?? ""));
  if (text.length < 60) return true; // أقصر من أن يكون مبدأً
  if (isMetadataText(text)) return true;
  // مكرّر بالكامل من العنوان (لا محتوى مضاف).
  const t = clean(String(title ?? ""));
  if (t && t === text && isMetadataText(t)) return true;
  return false;
}
