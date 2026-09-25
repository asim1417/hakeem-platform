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
 * الحدود عربي↔عربي (كلمتان عربيتان ملتصقتان) فلا نُخمّنها — تبقى للمراجعة من المصدر الأصلي،
 * باستثناء **قائمة سماح ثابتة** لتواقيع الأحكام الشائعة (انظر unglueKnownSignatureGlue).
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

/** أنماط التصاق تواقيع الأحكام الشائعة — مسافة فقط، بلا إضافة/حذف حروف. */
const SIGNATURE_UNGLUE: Array<{ re: RegExp; to: string }> = [
  { re: /رئيسالدائرة/g, to: "رئيس الدائرة" },
  { re: /رئيس الدائرةالقضائية/g, to: "رئيس الدائرة القضائية" },
  // اسم ملتصق بعد «القضائية»
  { re: new RegExp(`(رئيس الدائرة القضائية)([${ARLET}])`, "g"), to: "$1 $2" },
  // اسم ملتصق بعد «الدائرة» مباشرة — لا يمسّ « القضائية» ولا فراغاً موجوداً
  { re: new RegExp(`(رئيس الدائرة)(?!\\s)(?!القضائية)([${ARLET}])`, "g"), to: "$1 $2" },
  { re: /عضو(?=فرحان|محمد|ناصر|أحمد|احمد|عبد|ﷲ)/g, to: "عضو " },
  // مسافة قبل «رئيس» فقط إن التصقت بـ الموفق/التوفيق — لا تُصلح حرفاً ناقصاً (ريس ≠ رئيس)
  { re: /(الموفق|التوفيق)(?=رئيس)/g, to: "$1 " },
];

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

/** فكّ التصاق تواقيع معروفة بقائمة سماح — إدراج مسافة فقط. */
export function unglueKnownSignatureGlue(s: string): string {
  let out = s;
  for (const { re, to } of SIGNATURE_UNGLUE) out = out.replace(re, to);
  return out;
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

/**
 * تنقية عرض مخصّصة للأحكام: sanitizeDisplayText + فكّ تواقيع قائمة السماح.
 * لا تكتب في القاعدة؛ للعرض/الفهرس فقط.
 */
export function sanitizeJudgmentDisplay(raw: string | null | undefined): string {
  return unglueKnownSignatureGlue(sanitizeDisplayText(raw));
}

export type JudgmentTextClass = "clean" | "auto_fixable" | "needs_human";

export interface JudgmentSanitizeReport {
  class: JudgmentTextClass;
  changed: boolean;
  ops: string[];
  flags: string[];
  beforeLen: number;
  afterLen: number;
  sanitized: string;
}

const RE_ZW = /[\u200B-\u200D\u2060\uFEFF\u00AD\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
const RE_CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;
const RE_TATWEEL = /\u0640{2,}/;
const RE_FFFD = /\uFFFD/;
const RE_HTML = /&[a-zA-Z#0-9]+;|<\/?[a-zA-Z][^>]*>/;
const RE_SIG_GLUE = /رئيسالدائرة|رئيس الدائرةالقضائية|رئيس الدائرة القضائية[\u0621-\u064A]|رئيس الدائرة(?!\s)(?!القضائية)[\u0621-\u064A]|عضو(?=فرحان|محمد|ناصر|أحمد|احمد|عبد|ﷲ)|(الموفق|التوفيق)(?=رئيس)/;
const RE_SAFE_BOUND = /[0-9A-Za-z][\u0621-\u064A]|[\u0621-\u064A][0-9A-Za-z]|[.،؛!؟][\u0621-\u064A]/;
const RE_CLOSING = /والله الموفق|وصلى الله|وصحبه|أجمعين|حرر في|رئيس الدائرة|عضو|وبالله التوفيق/i;
const RE_MISSING_LETTER = /(^|[^\u0621-\u064A])ئيس الدائرة|الموفقريس/;

/**
 * يصنّف نص حكم: نظيف / قابل للإصلاح الآلي / يحتاج مراجعة بشرية.
 * لا يخمّن حروفاً ناقصة ولا يملأ `???`.
 */
export function classifyJudgmentText(raw: string | null | undefined): JudgmentSanitizeReport {
  const before = raw ?? "";
  const sanitized = sanitizeJudgmentDisplay(before);
  const normalizedInput = before.replace(/\r\n?/g, "\n").trim();
  const changed = sanitized !== normalizedInput;

  const ops: string[] = [];
  if (RE_ZW.test(before)) ops.push("strip_zero_width_or_bidi");
  if (RE_CTRL.test(before)) ops.push("strip_controls");
  if (RE_TATWEEL.test(before)) ops.push("collapse_tatweel");
  if (RE_SIG_GLUE.test(before)) ops.push("unglue_signature");
  if (/ {3,}|\t|\n{4,}/.test(before)) ops.push("normalize_whitespace");
  if (RE_SAFE_BOUND.test(before)) ops.push("separate_safe_boundaries");

  const flags: string[] = [];
  if (RE_FFFD.test(before)) flags.push("replacement_char");
  if (RE_HTML.test(before)) flags.push("html_leak");
  if (RE_MISSING_LETTER.test(before)) flags.push("possible_missing_letter");
  if (/\?{2,}/.test(before)) flags.push("redaction_placeholders");

  const trimmed = before.trim();
  if (
    trimmed.length >= 300 &&
    /[\u0600-\u06FF]$/.test(trimmed) &&
    !/[.!?؟؛۔…]/.test(trimmed.slice(-80)) &&
    !RE_CLOSING.test(trimmed.slice(-160))
  ) {
    flags.push("possible_abrupt_end");
  }

  const critical = flags.filter((f) => f !== "redaction_placeholders");
  let cls: JudgmentTextClass = "clean";
  if (critical.length > 0 || flags.includes("redaction_placeholders")) cls = "needs_human";
  else if (changed || ops.length > 0) cls = "auto_fixable";

  return {
    class: cls,
    changed,
    ops: [...new Set(ops)],
    flags: [...new Set(flags)],
    beforeLen: before.length,
    afterLen: sanitized.length,
    sanitized,
  };
}
