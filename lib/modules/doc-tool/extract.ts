// استخراج نص الملفات داخل المتصفح — لا يغادر الملف جهاز المستخدم.
// موحَّد مع «منصة الوثائق»: يعيد استخدام محرّكاتها نفسها (document-inspection):
// نص مباشر · Word (docx) · PDF نصّي (pdfjs) · PDF ممسوح وصور عبر OCR عربي (Tesseract).
// الاستيراد ديناميكي حتى لا تُحمَّل pdfjs/tesseract إلا عند الحاجة.

export interface ExtractResult {
  text: string;
  /** وصف طريقة الاستخراج بالعربية — يُعرض للمستخدم */
  kind: string;
  /** تحذير غير مانع (مثل صفحات فارغة) */
  warning?: string;
}

/** تقدّم المعالجة الطويلة (OCR) — نص عربي جاهز للعرض */
export type ExtractProgress = (label: string) => void;

const TEXT_EXTS = ["txt", "md", "csv", "json"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"];

/** يستخرج نص ملف بحسب صيغته — يعمل في المتصفح فقط */
export async function extractFile(file: File, onProgress?: ExtractProgress): Promise<ExtractResult> {
  const ext = (file.name.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();

  if (TEXT_EXTS.includes(ext)) {
    return { text: new TextDecoder("utf-8").decode(await file.arrayBuffer()), kind: "نص" };
  }

  if (ext === "docx") {
    try {
      const { extractDocxText } = await import("@/lib/modules/document-inspection/file-extract");
      return { text: await extractDocxText(await file.arrayBuffer()), kind: "Word" };
    } catch (err) {
      return { text: "", kind: `تعذّر (${errMsg(err)})` };
    }
  }

  if (ext === "pdf") {
    return extractPdf(file, onProgress);
  }

  if (IMAGE_EXTS.includes(ext)) {
    return extractImage(file, onProgress);
  }

  return { text: "", kind: "صيغة غير مدعومة" };
}

async function extractPdf(file: File, onProgress?: ExtractProgress): Promise<ExtractResult> {
  const buffer = await file.arrayBuffer();
  try {
    const { extractPdfText } = await import("@/lib/modules/document-inspection/file-extract");
    onProgress?.("قراءة نص الـ PDF…");
    const result = await extractPdfText(buffer);
    const bare = result.text.replace(/\[صفحة \d+\]/g, "").trim();
    // ممسوح ضوئياً أو طبقة نص معطوبة → OCR على صور الصفحات
    if (bare.length < 20 || result.needsOcr) {
      return ocrPdf(buffer, onProgress);
    }
    const warning =
      result.emptyPages > 0
        ? `${result.emptyPages} من ${result.pages} صفحة بلا نص (ممسوحة؟)`
        : undefined;
    return { text: result.text, kind: "PDF (نص)", warning };
  } catch (err) {
    // فشل فك النص (ملف صور خالص مثلاً) — جرّب OCR قبل الاستسلام
    try {
      return await ocrPdf(buffer, onProgress);
    } catch {
      return { text: "", kind: `تعذّر (${errMsg(err)})` };
    }
  }
}

async function ocrPdf(buffer: ArrayBuffer, onProgress?: ExtractProgress): Promise<ExtractResult> {
  const { ocrScannedPdf, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
  const { fixReversedArabicLines } = await import("@/lib/modules/document-inspection/text-quality");
  onProgress?.("تحضير القراءة الضوئية…");
  const { text, avgConfidence } = await ocrScannedPdf(buffer, (info) =>
    onProgress?.(
      `OCR صفحة ${info.page}/${info.pages} — ${translateOcrStatus(info.status)} ${Math.round((info.progress || 0) * 100)}٪`
    )
  );
  if (text.replace(/\[صفحة \d+\]/g, "").trim().length < 10) {
    return { text: "", kind: "تعذّرت القراءة الضوئية — تأكد من وضوح المسح" };
  }
  const fixed = fixReversedArabicLines(text);
  return { text: fixed.text, kind: `PDF ممسوح (OCR ${Math.round(avgConfidence)}٪)` };
}

async function extractImage(file: File, onProgress?: ExtractProgress): Promise<ExtractResult> {
  try {
    const { ocrImage, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
    const { fixReversedArabicLines } = await import("@/lib/modules/document-inspection/text-quality");
    onProgress?.("تحضير القراءة الضوئية…");
    const { text, confidence } = await ocrImage(file, (info) =>
      onProgress?.(`${translateOcrStatus(info.status)} ${Math.round((info.progress || 0) * 100)}٪`)
    );
    if (text.trim().length < 5) {
      return { text: "", kind: "لم يُقرأ نص من الصورة — تأكد من وضوحها" };
    }
    const fixed = fixReversedArabicLines(text);
    return { text: fixed.text, kind: `صورة (OCR ${Math.round(confidence)}٪)` };
  } catch (err) {
    return { text: "", kind: `تعذّر (${errMsg(err)})` };
  }
}

function errMsg(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 60);
}
