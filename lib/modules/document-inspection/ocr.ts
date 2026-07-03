// OCR داخل المتصفح (Tesseract.js) — للصور والوثائق الممسوحة ضوئياً.
// خصوصية: صورة الوثيقة لا تغادر المتصفح؛ نموذج التعرّف فقط يُجلب من CDN عند أول استخدام.
// يعمل في المتصفح حصراً (يستورد tesseract.js ديناميكياً).

export type OcrProgress = (info: { status: string; progress: number }) => void;

const OCR_LANGS = "ara+eng";
// استضافة ذاتية بالكامل تحت public/tesseract — لا اعتماد على أي طرف ثالث،
// وتعمل دون اتصال، ولا CSP خارجي. النموذج العربي والنواة والعامل محلية.
const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract/tesseract-core-simd.wasm.js";
const LANG_PATH = "/tesseract/lang";

const STATUS_AR: Record<string, string> = {
  "loading tesseract core": "تحميل نواة التعرّف",
  "initializing tesseract": "تهيئة المحرّك",
  "loading language traineddata": "تحميل النموذج العربي",
  "initializing api": "تجهيز الواجهة",
  "recognizing text": "قراءة النص"
};

export function translateOcrStatus(status: string): string {
  return STATUS_AR[status] ?? status;
}

interface RecognizeResult {
  text: string;
  confidence: number;
}

/** يشغّل OCR على صورة/لوحة (Blob أو canvas أو dataURL) ويعيد النص العربي المستخرج */
export async function ocrImage(source: Blob | HTMLCanvasElement | string, onProgress?: OcrProgress): Promise<RecognizeResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(OCR_LANGS, 1, {
    workerPath: WORKER_PATH,
    langPath: LANG_PATH,
    corePath: CORE_PATH,
    logger: onProgress
      ? (m: { status: string; progress: number }) => onProgress({ status: m.status, progress: m.progress })
      : undefined
  });
  try {
    const { data } = await worker.recognize(source as Parameters<typeof worker.recognize>[0]);
    return { text: (data.text ?? "").trim(), confidence: data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}

/** يحوّل صفحة PDF (عبر pdfjs) إلى canvas بدقة مناسبة للـ OCR */
async function renderPdfPageToCanvas(page: unknown, scale = 2): Promise<HTMLCanvasElement> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = page as any;
  const viewport = p.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر إنشاء لوحة الرسم");
  await p.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export interface ScannedPdfResult {
  text: string;
  pages: number;
  avgConfidence: number;
}

/** OCR لكامل ملف PDF ممسوح ضوئياً: يرسم كل صفحة ثم يقرأها */
export async function ocrScannedPdf(
  buffer: ArrayBuffer,
  onProgress?: (info: { page: number; pages: number; status: string; progress: number }) => void
): Promise<ScannedPdfResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  let confSum = 0;
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const canvas = await renderPdfPageToCanvas(page);
    const { text, confidence } = await ocrImage(canvas, (info) =>
      onProgress?.({ page: p, pages: doc.numPages, status: info.status, progress: info.progress })
    );
    confSum += confidence;
    parts.push(`[صفحة ${p}]\n${text}`);
    canvas.width = 0;
    canvas.height = 0;
  }
  await doc.destroy();
  return { text: parts.join("\n\n").trim(), pages: doc.numPages, avgConfidence: doc.numPages ? confSum / doc.numPages : 0 };
}

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

export function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.includes(ext.toLowerCase());
}
