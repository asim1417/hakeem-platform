/**
 * محلّل الأعداد الترتيبية العربية في عناوين المواد.
 *
 * الغرض الرقابي: رقم المادة المخزَّن (articleNumber) قد يُفبرَك أو يُزاح أثناء
 * الترحيل، أمّا عنوان المادة («المادة السادسة والستون بعد الأربعمائة») فهو جزء من
 * النص الرسمي المنشور. مقارنة الاثنين تكشف الانزياح الذي لا يكشفه قيد التفرّد
 * @@unique([lawName, articleNumber])، لأنّ ذلك القيد يمنع تكرار المفتاح فقط ولا
 * يُثبت أنّ الرقم يطابق عنوان المادة ونصّها.
 *
 * ⚠️ لا يجوز اشتقاق العنوان من الرقم (مثل `المادة ${n}`) — فذلك يجعل الفحص دائريًا
 * ويُخفي الانزياح. انظر تقرير التدقيق reports/legal-data-audit-2026-09-11/.
 */

const ONES: Record<string, number> = {
  "الأولى": 1, "الاولى": 1, "الحادية": 1, "الواحدة": 1, "الثانية": 2, "الثالثة": 3,
  "الرابعة": 4, "الخامسة": 5, "السادسة": 6, "السابعة": 7, "الثامنة": 8, "التاسعة": 9,
};

const TENS: Record<string, number> = {
  "العشرون": 20, "العشرين": 20, "الثلاثون": 30, "الثلاثين": 30,
  "الأربعون": 40, "الاربعون": 40, "الأربعين": 40, "الاربعين": 40,
  "الخمسون": 50, "الخمسين": 50, "الستون": 60, "الستين": 60,
  "السبعون": 70, "السبعين": 70, "الثمانون": 80, "الثمانين": 80,
  "التسعون": 90, "التسعين": 90,
};

const HUNDREDS: Record<string, number> = {
  "المائة": 100, "المئة": 100,
  "المائتين": 200, "المائتان": 200, "المئتين": 200, "المئتان": 200,
  "الثلاثمائة": 300, "الثلاثمئة": 300, "الأربعمائة": 400, "الاربعمائة": 400, "الأربعمئة": 400,
  "الخمسمائة": 500, "الخمسمئة": 500, "الستمائة": 600, "الستمئة": 600,
  "السبعمائة": 700, "السبعمئة": 700, "الثمانمائة": 800, "الثمانمئة": 800,
  "التسعمائة": 900, "التسعمئة": 900, "الألف": 1000, "الالف": 1000,
};

/** تطبيع عربي: إسقاط التشكيل والتطويل، توحيد الهمزات والتاء المربوطة والألف المقصورة. */
export function normalizeArabic(input: string): string {
  return String(input ?? "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[‎‏؜]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const n = (o: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [normalizeArabic(k), v]));

const N_ONES = n(ONES);
const N_TENS = n(TENS);
const N_HUNDREDS = n(HUNDREDS);

/**
 * يُرجع الرقم المستخرج من عنوان المادة، أو null إذا تعذّر التحليل.
 * أمثلة: «المادة السادسة والستون بعد الأربعمائة» → 466، «المادة العاشرة» → 10.
 */
export function parseArabicOrdinal(title: string): number | null {
  let t = normalizeArabic(title)
    .replace(/^الماده\s*/, "")
    .replace(/^ماده\s*/, "")
    .replace(/[():\-–—.,،]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;

  // أرقام صريحة (هندية/لاتينية) دون لفظ ترتيبي
  const digits = t.match(/(\d+)/);
  if (digits && !/[؀-ۿ]{3,}/.test(t.replace(/\d/g, ""))) {
    return parseInt(digits[1], 10);
  }

  let base = t;
  let afterPart: string | null = null;
  const split = t.split(/\sبعد\s/);
  if (split.length === 2) {
    base = split[0].trim();
    afterPart = split[1].trim();
  }

  let total = 0;
  if (afterPart !== null) {
    let matched = false;
    for (const [k, v] of Object.entries(N_HUNDREDS)) {
      if (afterPart === k || afterPart.startsWith(k)) { total += v; matched = true; break; }
    }
    if (!matched) return null;
  }

  let sub = 0;
  let ok = false;
  for (let part of base.split(/\sو/).map((s) => s.trim()).filter(Boolean)) {
    part = part.replace(/^و/, "").trim();
    const teen = part.match(/^(\S+)\s+عشره$/);
    if (teen && N_ONES[teen[1]] !== undefined) { sub += 10 + N_ONES[teen[1]]; ok = true; continue; }
    if (part === "العاشره") { sub += 10; ok = true; continue; }
    if (N_TENS[part] !== undefined) { sub += N_TENS[part]; ok = true; continue; }
    if (N_HUNDREDS[part] !== undefined) { sub += N_HUNDREDS[part]; ok = true; continue; }
    if (N_ONES[part] !== undefined) { sub += N_ONES[part]; ok = true; continue; }
    return null;
  }
  if (!ok) return null;
  return total + sub;
}

export type TitleNumberCheck =
  | { status: "match"; parsed: number }
  | { status: "mismatch"; parsed: number; stored: number; offset: number }
  | { status: "unparseable" };

/** بوابة الاستيراد: هل يطابق رقم المادة المخزَّن العددَ الترتيبي في عنوانها؟ */
export function checkTitleAgainstNumber(title: string, storedNumber: number): TitleNumberCheck {
  const parsed = parseArabicOrdinal(title);
  if (parsed === null) return { status: "unparseable" };
  if (parsed === storedNumber) return { status: "match", parsed };
  return { status: "mismatch", parsed, stored: storedNumber, offset: parsed - storedNumber };
}
