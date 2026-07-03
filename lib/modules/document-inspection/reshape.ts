// إعادة تشكيل النص العربي المستخرَج من طبقة نصّ PDF المعطوبة.
//
// كثير من ملفات PDF تخزّن الحروف العربية كـ«صور حروف» (Arabic Presentation Forms)
// معزولةً ومفصولةً بمسافات وبترتيب بصري، أحياناً مُضاعَفة، وأحياناً بخطّ مُجزّأ
// (subsetted) بلا خريطة يونيكود صحيحة — فيخرج نصّ مثل: «ﻣ ﺎ أ ﻣ ﺎ» أو «% I J».
//
// هذه الوحدة تعالج ما يمكن علاجه حتمياً:
//  1) تحويل صيغ العرض (FE70–FEFC، FB50–FDFF) إلى الحروف الأساسية عبر NFKC.
//  2) إعادة بناء حدود الكلمات من «صنف الوصل»: الحرف بصيغة أوّل/وسط يصل بما بعده،
//     فالمسافة التي تليه وهميّة تُحذف؛ وبصيغة معزول/آخِر ينهي الكلمة.
//  3) إزالة التكرار المضاعف المتلاصق (كلمات/أسطر مُعادة حرفياً).
//
// ما لا يُعالَج هنا (خطّ مُجزّأ بلا يونيكود → رموز لاتينية) يُكشَف بـ isGarbledArabicText
// ويُوجَّه إلى OCR على صورة الصفحة — وهو المصدر الصحيح الوحيد لتلك الحالة.

// أكواد «الأول/الوسط» في كتلة صيغ العرض-ب (تصل بالحرف التالي).
// لكل حرف رباعي الصيغ: المعزول=iso، الآخِر=iso+1، الأول=iso+2، الوسط=iso+3.
const FOUR_FORM_ISOLATED = [
  0xfe89, // ئ
  0xfe8f, // ب
  0xfe95, // ت
  0xfe99, // ث
  0xfe9d, // ج
  0xfea1, // ح
  0xfea5, // خ
  0xfeb1, // س
  0xfeb5, // ش
  0xfeb9, // ص
  0xfebd, // ض
  0xfec1, // ط
  0xfec5, // ظ
  0xfec9, // ع
  0xfecd, // غ
  0xfed1, // ف
  0xfed5, // ق
  0xfed9, // ك
  0xfedd, // ل
  0xfee1, // م
  0xfee5, // ن
  0xfee9, // ه
  0xfef1 // ي
];

const JOINS_NEXT = new Set<number>();
for (const iso of FOUR_FORM_ISOLATED) {
  JOINS_NEXT.add(iso + 2); // الأول
  JOINS_NEXT.add(iso + 3); // الوسط
}

function isPresentationForm(code: number): boolean {
  return (code >= 0xfe70 && code <= 0xfefc) || (code >= 0xfb50 && code <= 0xfdff);
}

const PF_RE = /[ﭐ-﷿ﹰ-ﻼ]/;

function reshapeLine(line: string): string {
  const words: string[] = [];
  let word = "";
  let prevJoinsNext = false;
  const flush = () => {
    if (word) {
      words.push(word);
      word = "";
    }
  };
  for (const ch of line) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === " " || ch === "\t") {
      // مسافة حقيقية فقط إن كان الحرف السابق لا يصل بالتالي؛ وإلا فهي وهميّة بين صور الحروف
      if (!prevJoinsNext) flush();
      prevJoinsNext = false;
      continue;
    }
    if (isPresentationForm(code)) {
      word += ch.normalize("NFKC"); // صورة الحرف → الحرف الأساسي (وقد يكون رباطاً كـ«لا/الله»)
      prevJoinsNext = JOINS_NEXT.has(code);
      continue;
    }
    // محرف عادي (حرف أساسي/رقم/علامة): يلتصق بالكلمة الجارية، ولا نفترض له وصلاً
    word += ch;
    prevJoinsNext = false;
  }
  flush();
  return words.join(" ");
}

/** يحوّل صيغ العرض إلى حروف أساسية ويعيد بناء حدود الكلمات. آمن على النص السليم (يعيده كما هو). */
export function reshapeArabicPresentationForms(text: string): string {
  if (!PF_RE.test(text)) return text;
  return text
    .split("\n")
    .map(reshapeLine)
    .join("\n")
    .replace(/[ \t]{2,}/g, " ");
}

/** يزيل التكرار المضاعف المتلاصق: كلمة/سطر يتكرّر حرفياً مباشرةً بعد نفسه. */
export function dedupeAdjacentDuplicates(text: string): string {
  const lines = text.split("\n");
  const outLines: string[] = [];
  for (const line of lines) {
    if (outLines.length && outLines[outLines.length - 1] === line && line.trim()) continue; // سطر مُعاد
    const toks = line.split(" ");
    const dedup: string[] = [];
    for (const t of toks) {
      if (dedup.length && dedup[dedup.length - 1] === t && /[ء-ي]/.test(t) && t.length >= 2) continue; // كلمة مُعادة
      dedup.push(t);
    }
    outLines.push(dedup.join(" "));
  }
  return outLines.join("\n");
}

export interface GarbleReport {
  garbled: boolean;
  /** نسبة صيغ العرض قبل إعادة التشكيل */
  presentationRatio: number;
  /** نسبة الكلمات المُضاعَفة المتلاصقة */
  duplicationRatio: number;
  /** نسبة الرموز اللاتينية/الغريبة وسط نصّ عربي (بديل خطّ مُجزّأ لا يُعالَج إلا بـ OCR) */
  substitutionRatio: number;
  /** نسبة الكلمات المكوّنة من حرف عربي واحد (تقطيع مفرط) */
  singleLetterRatio: number;
}

/**
 * يكشف نصّ طبقة PDF المعطوب. يُحسب على النصّ الخام (قبل إعادة التشكيل) لصيغ العرض
 * والتقطيع، وبعدها لبقايا الرموز البديلة. garbled=true يعني أنّ إعادة التشكيل وحدها
 * لا تكفي والمصدر الصحيح هو OCR على صورة الصفحة.
 */
export function isGarbledArabicText(rawText: string): GarbleReport {
  const text = rawText.replace(/\[صفحة \d+\]/g, " ");
  let pf = 0;
  let arabic = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (isPresentationForm(c)) pf += 1;
    else if (c >= 0x0620 && c <= 0x064a) arabic += 1;
  }
  const presentationRatio = pf / (pf + arabic + 1);

  const words = text.split(/\s+/).filter(Boolean);
  const arabicWords = words.filter((w) => /[ء-يﭐ-﷿ﹰ-ﻼ]/.test(w));
  let dup = 0;
  for (let i = 1; i < arabicWords.length; i += 1) if (arabicWords[i] === arabicWords[i - 1]) dup += 1;
  const duplicationRatio = dup / (arabicWords.length + 1);

  let single = 0;
  for (const w of arabicWords) {
    const letters = [...w].filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return (c >= 0x0620 && c <= 0x064a) || isPresentationForm(c);
    });
    if (letters.length === 1) single += 1;
  }
  const singleLetterRatio = single / (arabicWords.length + 1);

  // الرموز البديلة: بعد إعادة التشكيل، حروف لاتينية/رموز وسط سياق عربي كثيف
  const reshaped = reshapeArabicPresentationForms(text);
  const latin = (reshaped.match(/[A-Za-z%@#&]/g) ?? []).length;
  const arabicAfter = (reshaped.match(/[ء-ي]/g) ?? []).length;
  const substitutionRatio = arabicAfter > 40 ? latin / (latin + arabicAfter) : 0;

  const garbled =
    presentationRatio > 0.3 || singleLetterRatio > 0.4 || duplicationRatio > 0.25 || substitutionRatio > 0.12;

  return { garbled, presentationRatio, duplicationRatio, substitutionRatio, singleLetterRatio };
}

/**
 * ينظّف نصّ طبقة PDF: إعادة تشكيل + إزالة التكرار. يعيد النصّ المُنظَّف ومؤشّراً
 * إلى بقاء عطب يستوجب OCR (رموز بديلة من خطّ مُجزّأ لا تُعالَج نصّياً).
 */
export function cleanPdfTextLayer(rawText: string): { text: string; needsOcr: boolean; report: GarbleReport } {
  const report = isGarbledArabicText(rawText);
  let text = reshapeArabicPresentationForms(rawText);
  if (report.duplicationRatio > 0.1 || report.garbled) text = dedupeAdjacentDuplicates(text);
  // إعادة التشكيل تُصلح الحالة الشائعة (صيغ عرض بحدود كلمات سليمة). لكنها لا تستطيع
  // استرجاع حدود الكلمات حين تُفصل كلّ صورة حرف بمسافة (singleLetterRatio عالٍ)،
  // ولا إصلاح الخطّ المُجزّأ (رموز بديلة). في هاتين الحالتين المصدر الصحيح هو OCR.
  const needsOcr = report.substitutionRatio > 0.12 || report.singleLetterRatio > 0.45;
  return { text, needsOcr, report };
}
