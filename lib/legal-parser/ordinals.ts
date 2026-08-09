/**
 * ordinals.ts — تحويل رقم المادة/التقسيم من صورته اللفظية أو الرقمية إلى عدد.
 *
 * يدعم: الأرقام بقوسين «(12)» و«١٢»، والأعداد اللفظية العربية المركّبة حتى المئات
 * («الخامسة والثمانون بعد المائة» = 185، «الخامسة والستون بعد الستمائة» = 665)،
 * ومعالجة «مكرر» (الأولى مكرر → "1.1"). يعيد null إن تعذّر — فلا يُسقِط المستدعي
 * الوحدة، بل يبقي التسمية ويترك الرقم فارغًا.
 *
 * التغطية: 1–999 بالصيغ الشائعة نظاميًّا. تُوسَّع/تُتحقَّق على مدوّنة حقيقية.
 */

/** تطبيع خفيف: إزالة التشكيل، توحيد الهمزات، مع إبقاء ة/ى (مفاتيح الخرائط بنفس الصورة). */
function norm(s: string): string {
  return s
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ـ/g, "") // تطويل
    .replace(/\s+/g, " ")
    .trim();
}

/** أرقام هندية/عربية-فارسية → لاتينية. */
function normalizeDigits(s: string): string {
  const map: Record<string, string> = {
    "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
    "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  };
  return s.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
}

/** آحاد ترتيبية (المذكّر والمؤنّث، بعد تجريد «ال»). */
const UNITS: Record<string, number> = {
  اول: 1, اولى: 1, حادي: 1, حاديه: 1, حادية: 1,
  ثاني: 2, ثانيه: 2, ثانية: 2,
  ثالث: 3, ثالثه: 3, ثالثة: 3,
  رابع: 4, رابعه: 4, رابعة: 4,
  خامس: 5, خامسه: 5, خامسة: 5,
  سادس: 6, سادسه: 6, سادسة: 6,
  سابع: 7, سابعه: 7, سابعة: 7,
  ثامن: 8, ثامنه: 8, ثامنة: 8,
  تاسع: 9, تاسعه: 9, تاسعة: 9,
  عاشر: 10, عاشره: 10, عاشرة: 10,
  // صيغ بنود المنطوق الظرفية (أولًا/ثانيًا... بعد نزع التشكيل → اولا/ثانيا)
  اولا: 1, ثانيا: 2, ثالثا: 3, رابعا: 4, خامسا: 5, سادسا: 6, سابعا: 7, ثامنا: 8, تاسعا: 9, عاشرا: 10,
};

/** ترتيب الحروف الأبجدي (أبجد هوز...) لترقيم الفقرات الفرعية «أ- ب- ج-». */
const ABJAD = ["ا", "ب", "ج", "د", "ه", "و", "ز", "ح", "ط", "ي", "ك", "ل", "م", "ن", "س", "ع", "ف", "ص", "ق", "ر", "ش", "ت", "ث", "خ", "ذ", "ض", "ظ", "غ"];

/** يحوّل حرف الفقرة الفرعية إلى رتبته الأبجدية (أ=1). null إن لم يكن حرفًا مفردًا. */
export function arabicLetterOrdinal(letter: string): number | null {
  const l = letter.replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ـ/g, "").trim();
  const i = ABJAD.indexOf(l);
  return i === -1 ? null : i + 1;
}

/** عشرات. */
const TENS: Record<string, number> = {
  عشرون: 20, عشرين: 20,
  ثلاثون: 30, ثلاثين: 30,
  اربعون: 40, اربعين: 40,
  خمسون: 50, خمسين: 50,
  ستون: 60, ستين: 60,
  سبعون: 70, سبعين: 70,
  ثمانون: 80, ثمانين: 80,
  تسعون: 90, تسعين: 90,
};

/** مئات. */
const HUNDREDS: Record<string, number> = {
  مائه: 100, مائة: 100, مئه: 100, مئة: 100,
  مئتان: 200, مئتين: 200, مايتان: 200, مايتين: 200,
  ثلاثمائه: 300, ثلاثمائة: 300, ثلثمائة: 300, ثلاثمئة: 300,
  اربعمائه: 400, اربعمائة: 400, اربعمئة: 400,
  خمسمائه: 500, خمسمائة: 500, خمسمئة: 500,
  ستمائه: 600, ستمائة: 600, ستمئة: 600,
  سبعمائه: 700, سبعمائة: 700, سبعمئة: 700,
  ثمانمائه: 800, ثمانمائة: 800, ثمانمئة: 800, ثمانيمائة: 800,
  تسعمائه: 900, تسعمائة: 900, تسعمئة: 900,
};

const TEEN_WORD = new Set(["عشر", "عشره", "عشرة"]);

/** يجرّد «و» و«ال» البادئتين من الكلمة. */
function strip(token: string): string {
  let t = token;
  if (t.startsWith("و")) t = t.slice(1);
  if (t.startsWith("ال")) t = t.slice(2);
  return t;
}

export interface ParsedNumber {
  /** العدد الصحيح (بلا كسر «مكرر»). */
  value: number;
  /** الصورة المعياريّة للتخزين: "12" أو "12.1" عند «مكرر». */
  display: string;
  mukarrar: boolean;
}

/**
 * يحوّل نصّ رقم المادة (لفظيًّا أو رقميًّا) إلى عدد. يعيد null إن تعذّر.
 */
export function parseArabicNumber(raw: string): ParsedNumber | null {
  if (!raw) return null;
  const mukarrar = /مكرر/.test(raw);
  const cleaned = norm(normalizeDigits(raw)).replace(/مكرر/g, "").trim();

  // ① صورة رقمية صريحة: (12) أو 12
  const digitMatch = cleaned.match(/\d+/);
  if (digitMatch) {
    const value = Number.parseInt(digitMatch[0], 10);
    if (Number.isFinite(value)) return finalize(value, mukarrar);
  }

  // ② صورة لفظية مركّبة
  const tokens = cleaned.split(/\s+/).map(strip).filter(Boolean);
  if (!tokens.length) return null;

  // فصل جزء «بعد المئات»
  let mainTokens = tokens;
  let hundredsFromAfter = 0;
  const baIdx = tokens.indexOf("بعد");
  if (baIdx !== -1) {
    mainTokens = tokens.slice(0, baIdx);
    for (const t of tokens.slice(baIdx + 1)) {
      if (HUNDREDS[t] != null) hundredsFromAfter += HUNDREDS[t];
    }
  }

  let unit = 0;
  let tens = 0;
  let hundredsInline = 0;
  let teen = false;
  for (const t of mainTokens) {
    if (TEEN_WORD.has(t)) { teen = true; continue; }
    if (UNITS[t] != null) { unit = UNITS[t]; continue; }
    if (TENS[t] != null) { tens = TENS[t]; continue; }
    if (HUNDREDS[t] != null) { hundredsInline += HUNDREDS[t]; continue; }
  }

  let sub: number;
  if (teen) {
    // «الحادية عشرة» = 11 ... «التاسعة عشرة» = 19 (10 مضمّنة في كلمة عشرة)
    sub = 10 + (unit === 10 ? 0 : unit);
  } else {
    sub = (unit === 10 ? 10 : unit) + tens;
  }

  const total = sub + hundredsInline + hundredsFromAfter;
  if (total <= 0) return null;
  return finalize(total, mukarrar);
}

function finalize(value: number, mukarrar: boolean): ParsedNumber {
  return { value, display: mukarrar ? `${value}.1` : String(value), mukarrar };
}
