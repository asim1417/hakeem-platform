/**
 * display-text.ts — تنقية نصّ **العرض** (غير مُتلِفة للكلمات). المصدر في القاعدة يبقى كما هو؛
 * هذه الطبقة تُصلح ما يُفسد العرض فقط، بلا إضافة/حذف حروف أو تخمين نصّ قانوني:
 *  - إزالة المحارف صفرية العرض ومحارف الاتجاه الصريحة و soft hyphen (تسبّب تقطّع/تشابك).
 *  - إزالة محارف التحكّم غير المرئية.
 *  - توحيد أطراف الأسطر، وقصّ الفراغات الأفقية والأسطر الفارغة الزائدة مع **حفظ فواصل الفقرات**
 *    (تُعرض مع white-space: pre-wrap فتظهر بنية النصّ بدل تكتّله).
 *  - تخفيف التطويل (الكشيدة) المتكرّر — زخرفة لا معنى لها.
 *
 * فصل الحدود الآمن: نُدرج مسافة **فقط** عند حدٍّ لا يقع داخل كلمة عربية أبداً (رقم↔عربي،
 * لاتيني↔عربي، علامة جملة↔عربي). هذا **لا يمسّ بنية أي كلمة** (لا يُقسّم/يدمج حروفاً). أمّا
 * الحدود عربي↔عربي (كلمتان عربيتان ملتصقتان) فلا نُخمّنها — تبقى للمراجعة من المصدر الأصلي.
 */
const ZERO_WIDTH = new RegExp("[\\u200B-\\u200D\\u2060\\uFEFF\\u00AD]", "g"); // صفرية العرض + soft hyphen
const BIDI_CTRL = new RegExp("[\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]", "g"); // محارف اتجاه صريحة
const CONTROLS = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "g");
const TATWEEL_RUN = new RegExp("\\u0640{2,}", "g");

const DIGIT = "0-9\\u0660-\\u0669\\u06F0-\\u06F9";                 // أرقام لاتينية + عربية
// حروف عربية **فقط** (تستثني الأرقام العربية U+0660-0669/U+06F0-06F9 وعلامات الترقيم <U+0621).
const ARLET = "\\u0621-\\u065F\\u066E-\\u06D3\\u06D5-\\u06EF\\u06FA-\\u06FF\\u0750-\\u077F\\uFB50-\\uFDFF\\uFE70-\\uFEFF";
const B_DIGIT_AR = new RegExp(`([${DIGIT}])([${ARLET}])`, "g");
const B_AR_DIGIT = new RegExp(`([${ARLET}])([${DIGIT}])`, "g");
const B_LAT_AR = new RegExp(`([A-Za-z])([${ARLET}])`, "g");
const B_AR_LAT = new RegExp(`([${ARLET}])([A-Za-z])`, "g");
const B_PUNCT_AR = new RegExp(`([.،؛!؟])([${ARLET}])`, "g"); // علامة جملة ملتصقة بحرف عربي

/**
 * فصل حدٍّ آمن غير مُتلِف: مسافة عند حدود لا تقع داخل كلمة عربية (رقم/لاتيني/علامة جملة ↔ عربي).
 * لا يمسّ حروف أي كلمة. لا يُطبَّق على حدود عربي↔عربي (تحتاج المصدر الأصلي).
 */
export function separateSafeBoundaries(s: string): string {
  return s
    .replace(B_DIGIT_AR, "$1 $2")
    .replace(B_AR_DIGIT, "$1 $2")
    .replace(B_LAT_AR, "$1 $2")
    .replace(B_AR_LAT, "$1 $2")
    .replace(B_PUNCT_AR, "$1 $2");
}

export function sanitizeDisplayText(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n?/g, "\n");
  s = s.replace(ZERO_WIDTH, "").replace(BIDI_CTRL, "").replace(CONTROLS, "");
  s = s.replace(TATWEEL_RUN, "ـ"); // تطويل متكرّر → واحد
  s = separateSafeBoundaries(s);   // فصل حدود آمن (لا يمسّ بنية الكلمة)
  s = s.replace(/[ \t\f\v]+/g, " ");    // فراغات أفقية متعدّدة → واحدة (يحفظ الأسطر)
  s = s.replace(/ *\n/g, "\n");         // إزالة الفراغ قبل نهاية السطر
  s = s.replace(/\n{3,}/g, "\n\n");     // أسطر فارغة زائدة → فاصل فقرة واحد
  return s.trim();
}
