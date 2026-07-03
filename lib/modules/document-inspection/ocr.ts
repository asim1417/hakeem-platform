// OCR داخل المتصفح (Tesseract.js) — للصور والوثائق الممسوحة ضوئياً.
// خصوصية: صورة الوثيقة لا تغادر المتصفح؛ كل الأصول مستضافة ذاتياً تحت public/tesseract.
// يعمل في المتصفح حصراً (يستورد tesseract.js ديناميكياً).
//
// رفع الجودة (فلسفة أدوات القياس المفتوحة): معالجة مسبقة للصورة قبل التعرّف —
// تدرّج رمادي + عتبة Otsu (تحويل ثنائي) + تكبير الصور الصغيرة إلى ~300DPI،
// ورفع دقّة تحويل صفحات PDF، وضبط وسائط Tesseract للعربية.

export type OcrProgress = (info: { status: string; progress: number }) => void;

const OCR_LANGS = "ara+eng";
const WORKER_PATH = "/tesseract/worker.min.js";
const CORE_PATH = "/tesseract/tesseract-core-simd.wasm.js";
const LANG_PATH = "/tesseract/lang";

// وسائط تحسّن دقّة العربية: إبقاء المسافات بين الكلمات + وضع تجزئة «كتلة موحّدة».
const OCR_PARAMS = {
  preserve_interword_spaces: "1",
  tessedit_pageseg_mode: "6" // PSM 6: كتلة نصّ موحّدة (مناسب للمستندات)
};

// عتبة عرض دنيا؛ الصور الأصغر تُكبَّر لأن Tesseract يحتاج ~300DPI للجودة العالية.
const MIN_OCR_WIDTH = 1400;
// دقّة تحويل صفحات PDF الممسوح (كان 2؛ 3 يرفع الدقّة على حساب زمن أطول).
const PDF_OCR_SCALE = 3;

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

// ── المعالجة المسبقة للصورة (ترفع دقّة التعرّف بشكل ملموس) ──

async function sourceToCanvas(source: Blob | HTMLCanvasElement | string): Promise<HTMLCanvasElement> {
  if (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) return source;
  const url = typeof source === "string" ? source : URL.createObjectURL(source as Blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("تعذّر تحميل الصورة"));
      el.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("تعذّر إنشاء لوحة الرسم");
    ctx.drawImage(img, 0, 0);
    return canvas;
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/** عتبة Otsu: تجد الحدّ الأمثل لتحويل التدرّج الرمادي إلى أبيض/أسود */
function otsuThreshold(histogram: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];
  let sumB = 0;
  let wB = 0;
  let maxVar = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t += 1) {
    wB += histogram[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

// حدّ نسبة البكسلات الرماديّة المتوسطة الذي يميّز الصورة المتدهورة (تحتاج معالجة)
// عن النظيفة (ثنائية أصلاً، لا يجب تعتيبها). قياس goldset أثبت أن التعتيب يضرّ النظيف.
const MIDGRAY_DEGRADED = 0.12;

/** معالجة تكيّفية: للصور النظيفة تدرّج رمادي فقط؛ للمتدهورة عتبة Otsu.
 *  التكبير يُطبَّق فقط على الصور الصغيرة. أثبت القياس أن التعتيب غير المشروط يخفض الدقّة. */
export function preprocessCanvas(input: HTMLCanvasElement): HTMLCanvasElement {
  const scale = input.width < MIN_OCR_WIDTH ? Math.min(3, MIN_OCR_WIDTH / input.width) : 1;
  const w = Math.round(input.width * scale);
  const h = Math.round(input.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return input;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(input, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;
  const total = w * h;
  const gray = new Uint8Array(total);
  const histogram = new Array<number>(256).fill(0);
  let midGray = 0;
  for (let i = 0, g = 0; i < px.length; i += 4, g += 1) {
    const v = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    gray[g] = v;
    histogram[v] += 1;
    if (v >= 64 && v <= 192) midGray += 1;
  }
  // نظيفة (قليل من الرمادي المتوسط) → تدرّج رمادي فقط، بلا تعتيب يتلف وصلات الحروف
  const degraded = midGray / total >= MIDGRAY_DEGRADED;
  const threshold = degraded ? otsuThreshold(histogram, total) : 0;
  for (let i = 0, g = 0; i < px.length; i += 4, g += 1) {
    const v = degraded ? (gray[g] > threshold ? 255 : 0) : gray[g];
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = v;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

interface RecognizeResult {
  text: string;
  confidence: number;
}

/** يشغّل OCR على صورة/لوحة. المعالجة المسبقة اختيارية (معطّلة افتراضياً):
 *  قياس CER/WER على goldset أثبت أن الخام أدقّ على المحتوى النظيف (82.8% مقابل 61%).
 *  تُفعَّل preprocess=true فقط للمسح الرديء (بعد إثبات نفعه على صور مسح حقيقية). */
export async function ocrImage(
  source: Blob | HTMLCanvasElement | string,
  onProgress?: OcrProgress,
  options?: { preprocess?: boolean }
): Promise<RecognizeResult> {
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
    await worker.setParameters(OCR_PARAMS as unknown as Parameters<typeof worker.setParameters>[0]);
    let input: Blob | HTMLCanvasElement | string = source;
    if (options?.preprocess === true) {
      try {
        input = preprocessCanvas(await sourceToCanvas(source));
      } catch {
        input = source; // إن فشلت المعالجة، أكمل على الأصل
      }
    }
    const { data } = await worker.recognize(input as Parameters<typeof worker.recognize>[0]);
    return { text: (data.text ?? "").trim(), confidence: data.confidence ?? 0 };
  } finally {
    await worker.terminate();
  }
}

/** يحوّل صفحة PDF (عبر pdfjs) إلى canvas بدقة عالية للـ OCR */
async function renderPdfPageToCanvas(page: unknown, scale = PDF_OCR_SCALE): Promise<HTMLCanvasElement> {
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

/** OCR لكامل ملف PDF ممسوح ضوئياً: يرسم كل صفحة بدقّة عالية، يعالجها، ثم يقرأها */
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
    // دقّة عالية (scale 3) لكن بلا تعتيب — القياس أثبت أن الخام أدقّ
    const canvas = await renderPdfPageToCanvas(page);
    const { text, confidence } = await ocrImage(
      canvas,
      (info) => onProgress?.({ page: p, pages: doc.numPages, status: info.status, progress: info.progress }),
      { preprocess: false }
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
