/**
 * display-text.ts — تنقية نصّ **العرض** (غير مُتلِفة للكلمات). المصدر في القاعدة يبقى كما هو؛
 * هذه الطبقة تُصلح ما يُفسد العرض فقط، بلا إضافة/حذف حروف أو تخمين نصّ قانوني:
 *  - إزالة المحارف صفرية العرض ومحارف الاتجاه الصريحة و soft hyphen (تسبّب تقطّع/تشابك).
 *  - إزالة محارف التحكّم غير المرئية.
 *  - توحيد أطراف الأسطر، وقصّ الفراغات الأفقية والأسطر الفارغة الزائدة مع **حفظ فواصل الفقرات**
 *    (تُعرض مع white-space: pre-wrap فتظهر بنية النصّ بدل تكتّله).
 *  - تخفيف التطويل (الكشيدة) المتكرّر — زخرفة لا معنى لها.
 *
 * ملاحظة: لا نُدرج مسافات داخل الكلمات الملتصقة (لا نُخمّن) — تلك تُصدَّر للمراجعة اليدوية.
 */
const ZERO_WIDTH = new RegExp("[\\u200B-\\u200D\\u2060\\uFEFF\\u00AD]", "g"); // صفرية العرض + soft hyphen
const BIDI_CTRL = new RegExp("[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]", "g"); // محارف اتجاه صريحة
const CONTROLS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "g");
const TATWEEL_RUN = new RegExp("\\u0640{2,}", "g");

export function sanitizeDisplayText(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n?/g, "\n");
  s = s.replace(ZERO_WIDTH, "").replace(BIDI_CTRL, "").replace(CONTROLS, "");
  s = s.replace(TATWEEL_RUN, "ـ"); // تطويل متكرّر → واحد
  s = s.replace(/[ \t\f\v]+/g, " ");    // فراغات أفقية متعدّدة → واحدة (يحفظ الأسطر)
  s = s.replace(/ *\n/g, "\n");         // إزالة الفراغ قبل نهاية السطر
  s = s.replace(/\n{3,}/g, "\n\n");     // أسطر فارغة زائدة → فاصل فقرة واحد
  return s.trim();
}
