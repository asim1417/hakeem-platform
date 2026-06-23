/**
 * decree-extractor.ts — استخراج رقم وتاريخ المرسوم الملكي من نصوص الأنظمة.
 *
 * مبدأ أساسي: **لا اختلاق**. يُستخرج المرسوم فقط إذا ورد صراحةً في النصّ
 * (اسم النظام أو محتوى المادة). إن لم يُذكر، تُعاد القيمة null ولا نخمّن.
 *
 * الصِّيغ المدعومة (شائعة في الأنظمة السعودية):
 *   - مرسوم ملكي رقم م/51 وتاريخ 13/8/1442هـ
 *   - بالمرسوم الملكي رقم (م/١٩) بتاريخ ١٤٣٩/٥/٢٣هـ
 *   - الصادر بالمرسوم الملكي ذي الرقم م/٥ والتاريخ 4/2/1443
 *   - نظام ... الصادر بالأمر الملكي رقم أ/٩٠
 */

// تحويل الأرقام الهندية/العربية إلى لاتينية لتوحيد المعالجة.
const DIGIT_MAP: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export function normalizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => DIGIT_MAP[d] ?? d);
}

export interface ExtractedDecree {
  /** الصيغة المعروضة الكاملة، مثل: «م/51 وتاريخ 13/8/1442هـ» */
  decree: string;
  /** نوع الأداة النظامية */
  kind: "مرسوم ملكي" | "أمر ملكي" | "قرار مجلس الوزراء";
  /** رقم الأداة كما ورد، مثل: «م/51» أو «أ/90» */
  number: string;
  /** التاريخ الهجري كنصّ كما ورد، مثل: «13/8/1442هـ» (إن وُجد) */
  hijriDate: string | null;
}

const KIND_PATTERNS: Array<{ kind: ExtractedDecree["kind"]; re: RegExp }> = [
  // مرسوم/أمر ملكي رقم م/51 أو (م ٥١) — يلتقط الرمز والرقم.
  // نسمح بأداة التعريف «ال» (المرسوم الملكي) وبكلمة الوصل المختصرة.
  { kind: "مرسوم ملكي", re: /مرسوم\s*(?:ال)?ملكي\s*(?:رقم|ذي\s*الرقم|ذو\s*الرقم)?\s*[(:]?\s*([مأ])\s*\/?\s*([0-9]{1,4})/ },
  { kind: "أمر ملكي", re: /أمر\s*(?:ال)?ملكي\s*(?:رقم|ذي\s*الرقم|ذو\s*الرقم)?\s*[(:]?\s*([مأ])\s*\/?\s*([0-9]{1,4})/ },
  { kind: "قرار مجلس الوزراء", re: /قرار\s*مجلس\s*الوزراء\s*(?:رقم|ذي\s*الرقم)?\s*[(:]?\s*\(?\s*([0-9]{1,5})\)?/ },
];

// تاريخ هجري: 13/8/1442 أو 1442/8/13 — متبوعًا اختياريًا بـ «هـ».
// سنة هجرية منطقية بين 1300 و1500 لتفادي الالتقاط الخاطئ.
const HIJRI_DATE = /\b([0-9]{1,4})\s*\/\s*([0-9]{1,2})\s*\/\s*([0-9]{1,4})\s*(?:هـ|ه\b)?/g;

function findHijriDate(text: string): string | null {
  HIJRI_DATE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HIJRI_DATE.exec(text)) !== null) {
    const a = Number(m[1]);
    const c = Number(m[3]);
    // أحد الطرفين يجب أن يكون سنة هجرية معقولة.
    const year = a >= 1300 && a <= 1500 ? a : c >= 1300 && c <= 1500 ? c : null;
    if (year) return `${m[1]}/${m[2]}/${m[3]}هـ`;
  }
  return null;
}

/**
 * يستخرج أول مرسوم/أمر ملكي مذكور صراحةً في النصّ، أو null.
 * النصّ المُمرَّر عادةً: `${lawName}\n${articleContent}`.
 */
export function extractRoyalDecree(rawText: string | null | undefined): ExtractedDecree | null {
  if (!rawText) return null;
  const text = normalizeDigits(String(rawText)).replace(/\s+/g, " ");

  for (const { kind, re } of KIND_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;

    let number: string;
    if (kind === "قرار مجلس الوزراء") {
      number = m[1];
    } else {
      number = `${m[1]}/${m[2]}`;
    }

    // ابحث عن التاريخ الهجري ضمن نافذة قريبة بعد رقم الأداة.
    const after = text.slice(m.index, m.index + 120);
    const hijriDate = findHijriDate(after);

    const label =
      kind === "قرار مجلس الوزراء"
        ? `قرار مجلس الوزراء رقم (${number})`
        : `${kind} رقم ${number}`;
    const decree = hijriDate ? `${label} وتاريخ ${hijriDate}` : label;

    return { decree, kind, number, hijriDate };
  }

  return null;
}
