/**
 * تحويل عناوين المواد العربية إلى أرقام، والعكس.
 * «المادة الرابعة والسبعون» ⇄ 74   |   «المادة الخامسة عشرة مكرراً» ⇄ 15 مكرر
 *
 * لماذا هذا الملف أولًا: المعرّف الدائم للمادة (eId) يُبنى على رقمها،
 * والمصدر السعودي يكتب الرقم لفظًا لا رقمًا. فبلا هذا التحويل لا استكمال بأثر رجعي.
 */

export interface ArticleOrdinal {
  /** رقم المادة */
  number: number;
  /** درجة التكرار: 0 للأصل، 1 لـ«مكرر»، 2 لـ«مكرر مرتين» */
  bis: number;
}

const DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

/** تطبيع للمقارنة فقط — لا يُخزَّن ولا يُعرض */
export function normalizeAr(input: string): string {
  return input
    .replace(DIACRITICS, '')
    .replace(INVISIBLE, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

const AR_INDIC = '٠١٢٣٤٥٦٧٨٩';
const EXT_ARABIC = '۰۱۲۳۴۵۶۷۸۹';

/** ٧٤ → 74 */
export function toLatinDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const i = AR_INDIC.indexOf(d);
    return String(i >= 0 ? i : EXT_ARABIC.indexOf(d));
  });
}

/** 74 → ٧٤ */
export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => AR_INDIC[Number(d)]);
}

const UNITS: Record<string, number> = {
  اولي: 1, حاديه: 1, ثانيه: 2, ثالثه: 3, رابعه: 4, خامسه: 5,
  سادسه: 6, سابعه: 7, ثامنه: 8, تاسعه: 9,
};

const TENS: Record<string, number> = {
  عاشره: 10,
  عشرون: 20, عشرين: 20,
  ثلاثون: 30, ثلاثين: 30,
  اربعون: 40, اربعين: 40,
  خمسون: 50, خمسين: 50,
  ستون: 60, ستين: 60,
  سبعون: 70, سبعين: 70,
  ثمانون: 80, ثمانين: 80,
  تسعون: 90, تسعين: 90,
};

const HUNDREDS: Record<string, number> = {
  مائه: 100, مئه: 100,
  مائتين: 200, مائتان: 200, مئتين: 200, مئتان: 200,
  ثلاثمائه: 300, ثلاثمئه: 300,
  اربعمائه: 400, اربعمئه: 400,
  خمسمائه: 500, خمسمئه: 500,
  ستمائه: 600, ستمئه: 600,
  سبعمائه: 700, سبعمئه: 700,
  ثمانمائه: 800, ثمانمئه: 800,
  تسعمائه: 900, تسعمئه: 900,
};

const NOISE = new Set(['الماده', 'ماده', 'بعد', 'رقم', '،', ':', '-']);

/** إزالة «ال» التعريف من أول الكلمة عند الحاجة */
function bare(token: string): string {
  return token.startsWith('ال') && token.length > 3 ? token.slice(2) : token;
}

/**
 * يقرأ عنوان مادة بأي من صيغه ويعيد رقمها.
 * يقبل: اللفظي (رفعًا وجرًّا)، والرقمي عربيًّا ولاتينيًّا، وبين قوسين، ومع «مكرر».
 * يعيد null إذا لم يكن النص عنوان مادة.
 */
export function parseArticleOrdinal(input: string): ArticleOrdinal | null {
  if (!input) return null;
  let s = normalizeAr(input).replace(/[()\[\]«»"']/g, ' ').replace(/\s+/g, ' ').trim();

  // درجة التكرار
  let bis = 0;
  const bisMatch = s.match(/مكررا?\s*(مرتين|ثلاث مرات)?/);
  if (bisMatch) {
    bis = bisMatch[1] === 'مرتين' ? 2 : bisMatch[1] === 'ثلاث مرات' ? 3 : 1;
    s = s.replace(/مكررا?\s*(مرتين|ثلاث مرات)?/, ' ').trim();
  }

  // الصيغة الرقمية
  const digits = toLatinDigits(s).match(/\d+/);
  if (digits) {
    const n = Number(digits[0]);
    return n > 0 ? { number: n, bis } : null;
  }

  const tokens = s
    .split(' ')
    .map((t) => (t.length > 1 && t.startsWith('و') ? t.slice(1) : t))
    .filter((t) => t && !NOISE.has(t));

  let total = 0;
  let matched = false;
  let lastUnit: number | null = null;

  for (const raw of tokens) {
    const t = bare(raw);

    if (HUNDREDS[t] !== undefined) {
      total += HUNDREDS[t];
      matched = true;
      lastUnit = null;
      continue;
    }
    // علامة العَقد: «الحادية عشرة» — تُضاف عشرة إلى الآحاد السابقة
    if (t === 'عشره' || t === 'عشر') {
      if (lastUnit !== null) {
        total += 10;
        lastUnit = null;
        matched = true;
        continue;
      }
      total += 10;
      matched = true;
      continue;
    }
    if (UNITS[t] !== undefined) {
      total += UNITS[t];
      lastUnit = UNITS[t];
      matched = true;
      continue;
    }
    if (TENS[t] !== undefined) {
      total += TENS[t];
      lastUnit = null;
      matched = true;
      continue;
    }
    // كلمة غير معروفة داخل العنوان: تُتجاهل ولا تُبطل القراءة
  }

  if (!matched || total <= 0) return null;
  return { number: total, bis };
}

const UNIT_WORDS = ['', 'الحادية', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة'];
const TEN_WORDS_NOM: Record<number, string> = {
  20: 'العشرون', 30: 'الثلاثون', 40: 'الأربعون', 50: 'الخمسون',
  60: 'الستون', 70: 'السبعون', 80: 'الثمانون', 90: 'التسعون',
};
const TEN_WORDS_GEN: Record<number, string> = {
  20: 'العشرين', 30: 'الثلاثين', 40: 'الأربعين', 50: 'الخمسين',
  60: 'الستين', 70: 'السبعين', 80: 'الثمانين', 90: 'التسعين',
};

/**
 * 74 → «الرابعة والسبعون» رفعًا، أو «الرابعة والسبعين» جرًّا.
 * الجرّ هو المستعمل في الإحالة: «وفق المادة الرابعة والسبعين».
 */
export function formatArticleOrdinal(
  n: number,
  opts: { case?: 'nom' | 'gen'; bis?: number } = {},
): string {
  const grammaticalCase = opts.case ?? 'nom';
  const bis = opts.bis ?? 0;
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('رقم المادة يجب أن يكون عددًا صحيحًا موجبًا');

  const hundreds = Math.floor(n / 100) * 100;
  const rest = n % 100;
  const parts: string[] = [];

  const say = (r: number): string => {
    if (r === 0) return '';
    if (r === 1) return 'الأولى';
    if (r < 10) return UNIT_WORDS[r];
    if (r === 10) return 'العاشرة';
    if (r < 20) return `${UNIT_WORDS[r - 10]} عشرة`;
    const u = r % 10;
    const t = r - u;
    const tenWord = grammaticalCase === 'gen' ? TEN_WORDS_GEN[t] : TEN_WORDS_NOM[t];
    return u === 0 ? tenWord : `${UNIT_WORDS[u]} و${tenWord}`;
  };

  const restWord = say(rest);
  if (restWord) parts.push(restWord);

  if (hundreds) {
    const HW: Record<number, string> = {
      100: 'المائة', 200: 'المائتين', 300: 'الثلاثمائة', 400: 'الأربعمائة',
      500: 'الخمسمائة', 600: 'الستمائة', 700: 'السبعمائة', 800: 'الثمانمائة', 900: 'التسعمائة',
    };
    parts.push(restWord ? `بعد ${HW[hundreds]}` : HW[hundreds]);
  }

  let out = parts.join(' ');
  if (bis === 1) out += ' مكررًا';
  else if (bis === 2) out += ' مكررًا مرتين';
  else if (bis >= 3) out += ' مكررًا ثلاث مرات';
  return out;
}
