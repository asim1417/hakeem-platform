// ─────────────────────────────────────────────────────────────────────────────
// HKM-VOICE-NOTE-SA-007 §13 — تطبيع النصّ دون تحريف.
// محافظٌ: يصلح المسافات والترقيم ومصطلحاتٍ قانونيّة عالية الثقة فقط. لا يضيف موادّ/أرقامًا
// لم تُنطق، لا يحوّل العاميّة إلى ادّعاءٍ قانونيّ مختلف، ولا يمسّ أسماء الأشخاص. نقيّ.
// ─────────────────────────────────────────────────────────────────────────────

export interface NormalizedTranscript {
  rawTranscript: string;
  normalizedTranscript: string;
  changed: boolean;
}

// إصلاحاتٌ عالية الثقة لمصطلحاتٍ قانونيّة يخطئ فيها التفريغ العامّ كثيرًا (دقيقة ومحدودة).
const HIGH_CONFIDENCE_FIXES: Array<[RegExp, string]> = [
  [/المدع[اى]\s*علي?ه/g, "المدعى عليه"],
  [/المدعي?\b/g, "المدعي"],
  [/المستانف\b/g, "المستأنِف"],
  [/صحيفه\s*الدعو[ىي]/g, "صحيفة الدعوى"],
  [/مذكره\s*جوابيه/g, "مذكرة جوابية"],
  [/لائحه\s*اعتراضيه/g, "لائحة اعتراضية"],
  [/السند\s*التنفيذي/g, "السند التنفيذي"],
  [/نظام\s*المرافعات\s*الشرعيه/g, "نظام المرافعات الشرعية"],
  [/نظام\s*المعاملات\s*المدنيه/g, "نظام المعاملات المدنية"],
];

/** تطبيع المسافات وعلامات الترقيم العربيّة (بلا تغييرٍ للمعنى). */
function normalizeSpacingAndPunctuation(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *([،؛؟!.]) */g, "$1 ") // مسافةٌ بعد الترقيم لا قبله
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

export interface NormalizeOptions {
  /** توحيد الأرقام الغربيّة إلى عربيّة-هنديّة (اختياريّ §13). افتراض: لا. */
  unifyDigits?: boolean;
  /** تطبيق إصلاحات المصطلحات عالية الثقة. افتراض: نعم. */
  fixLegalTerms?: boolean;
}

const WESTERN_TO_ARABIC_DIGITS: Record<string, string> = {
  "0": "٠", "1": "١", "2": "٢", "3": "٣", "4": "٤",
  "5": "٥", "6": "٦", "7": "٧", "8": "٨", "9": "٩",
};

/**
 * §13 — يعيد النسختين: raw (كما ورد) وnormalized (محافظ). لا يختلق ولا يحذف معنى.
 */
export function normalizeTranscript(raw: string, opts: NormalizeOptions = {}): NormalizedTranscript {
  const rawTranscript = String(raw ?? "");
  let text = normalizeSpacingAndPunctuation(rawTranscript);

  if (opts.fixLegalTerms !== false) {
    for (const [re, rep] of HIGH_CONFIDENCE_FIXES) text = text.replace(re, rep);
  }
  if (opts.unifyDigits) {
    text = text.replace(/[0-9]/g, (d) => WESTERN_TO_ARABIC_DIGITS[d] ?? d);
  }

  const normalizedTranscript = text.trim();
  return {
    rawTranscript,
    normalizedTranscript,
    changed: normalizedTranscript !== rawTranscript.trim(),
  };
}
