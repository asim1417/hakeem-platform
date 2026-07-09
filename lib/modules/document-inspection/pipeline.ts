// النواة الموحّدة لمعالجة النص المُستخرَج — «دماغ» المنصّة، محايد البيئة تماماً.
//
// الغرض: مصدر حقيقة واحد لما نفعله بالنص بعد استخراجه — أياً كان مصدره (متصفح أو
// خادم، طبقة نصّ رقمية أو OCR محلي أو رؤية Gemini سحابية). يستدعيه السطحان بنفس
// المدخلات فيحصلان على نفس المخرجات بالبِت — فلا يتباعد محرّكان.
//
// كل التبعيات دوالٌ نقيّة (reshape · text-quality): لا DOM ولا canvas ولا شبكة.
// يعمل في المتصفح وفي Node على حدٍّ سواء (يثبته test-document-inspection على Node).

import { cleanPdfTextLayer, scrubLogoNoise, separateRunningLines } from "./reshape";
import { fixReversedArabicLines } from "./text-quality";
import { stripMarginLineNumbers } from "./margin-numbers";

/** منشأ النص المُستخرَج — يحدّد سلسلة المعالجة المناسبة له. */
export type TextSource =
  | "digital-layer" // طبقة نصّ PDF رقمية (قد تكون معطوبة → إصلاح/كشف OCR)
  | "ocr" // ناتج قراءة ضوئية محلية (Tesseract) — يحتاج عزل شعار وإصلاح انعكاس
  | "cloud"; // ناتج رؤية سحابية (Gemini) — نصّ سليم غالباً، فصل ترويسات فقط

export interface ProcessOptions {
  source: TextSource;
  /** عدد صفحات المستند — لعزل خربشة الشعار/الختم في الصفحة الأولى/الأخيرة (OCR). */
  totalPages?: number;
}

export interface ProcessedText {
  /** المتن النظيف الجاهز للعرض والفهرسة. */
  body: string;
  /** الترويسات/التذييلات المتكررة المفصولة كبيانات وصفية (إن وُجدت). */
  running?: string;
  /** طبقة النصّ الرقمية معطوبة بدرجة يتعذّر إصلاحها نصّياً → المصدر الصحيح OCR. */
  needsOcr: boolean;
  /** عدد الأسطر التي صُحِّح انعكاس اتجاهها (OCR). */
  correctedLines: number;
  /** عدد أرقام هامش الأسطر المتسلسلة التي حُذفت (ترقيمُ مدوّناتٍ التقطته الرؤية). */
  marginNumbersRemoved: number;
}

/**
 * يطبّق سلسلة المعالجة الموحّدة على نصٍّ مُستخرَج حسب منشئه، ويعيد المتن النظيف
 * مع بياناته الوصفية. لا يستخرج النص بنفسه — يتلقّاه جاهزاً من سطح الاستخراج
 * (المتصفح: pdfjs/tesseract/Gemini · الخادم: بارسر/Gemini) فيوحّد ما بعده.
 */
export function processExtractedText(rawText: string, opts: ProcessOptions): ProcessedText {
  let text = rawText ?? "";
  let needsOcr = false;
  let correctedLines = 0;

  if (opts.source === "digital-layer") {
    // طبقة نصّ رقمية: إعادة تشكيل صيغ العرض + إزالة التكرار، وكشف ما يستوجب OCR.
    const cleaned = cleanPdfTextLayer(text);
    text = cleaned.text;
    needsOcr = cleaned.needsOcr;
  } else if (opts.source === "ocr") {
    // قراءة ضوئية: اعزل خربشة الشعار/الختم أولاً، ثم أصلح الأسطر المعكوسة اتجاهاً.
    text = scrubLogoNoise(text, opts.totalPages);
    const fixed = fixReversedArabicLines(text);
    text = fixed.text;
    correctedLines = fixed.corrected.length;
  }
  // كل المصادر: افصل الترويسات/التذييلات المتكررة عن المتن (يعمل عند ≥3 صفحات).
  const sep = separateRunningLines(text);
  // احذف أرقام هامش الأسطر المتسلسلة (محافظ: يُبقي كل رقمِ متن؛ لا شيء يُحذف بلا تسلسل مثبَت).
  const stripped = stripMarginLineNumbers(sep.body);
  return {
    body: stripped.text,
    running: sep.running,
    needsOcr,
    correctedLines,
    marginNumbersRemoved: stripped.removed
  };
}
