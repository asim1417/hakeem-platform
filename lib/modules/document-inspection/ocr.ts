// OCR داخل المتصفح (Tesseract.js) — للصور والوثائق الممسوحة ضوئياً.
// خصوصية: صورة الوثيقة لا تغادر المتصفح؛ كل الأصول مستضافة ذاتياً تحت public/tesseract.
// يعمل في المتصفح حصراً (يستورد tesseract.js ديناميكياً).
//
// رفع الجودة (فلسفة أدوات القياس المفتوحة): معالجة مسبقة للصورة قبل التعرّف —
// تدرّج رمادي + عتبة Otsu (تحويل ثنائي) + تكبير الصور الصغيرة إلى ~300DPI،
// ورفع دقّة تحويل صفحات PDF، وضبط وسائط Tesseract للعربية.

import { scrubLogoNoise } from "./reshape";

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
// دقّة تحويل صفحات PDF الممسوح. زيني يستخدم 400DPI (pdf2image)؛ pdfjs الافتراضي
// 72DPI، فـ scale 5.5 ≈ 400DPI — نظير جودة صورة زيني (كان 3 ≈ 216DPI).
const PDF_OCR_SCALE = 5.5;

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

// ── معادلة الجودة الموثّقة من محرّك زيني (quality_metrics) لاختيار أفضل محاولة ──
// q = 100·(0.55·نسبة_عربية + 0.30·انتظام_الأسطر − 20·نسبة_الرموز − 0.15·نسبة_التقطيع)
// تُرجَّع درجة 0..100 (لا تعتمد على ثقة Tesseract التي أثبت زيني أنها أقلّ موثوقية).
function pageQualityScore(text: string): number {
  const t = (text || "").normalize("NFKC");
  if (t.trim().length < 3) return -1;
  const chars = t.length;
  const letters = Array.from(t).filter((c) => /[\p{L}]/u.test(c)).length;
  const arabic = Array.from(t).filter((c) => c >= "؀" && c <= "ۿ").length;
  const arRatio = arabic / Math.max(1, letters);
  const nonempty = t.split("\n").filter((l) => l.trim());
  const short = nonempty.filter((l) => l.trim().length <= 2).length;
  const lineReg = 1 - short / Math.max(1, nonempty.length);
  const fragRatio = short / Math.max(1, nonempty.length);
  const bad = (t.match(/[�□¿⸻]/g) ?? []).length;
  const badRatio = bad / Math.max(1, chars);
  const q = 100 * (0.55 * arRatio + 0.3 * lineReg - 20 * badRatio - 0.15 * fragRatio);
  return Math.max(0, Math.min(100, q));
}

// خمس استراتيجيات معالجة — نظير COMBOS في reocr_hard:
//   base/psm6 · otsu/psm6 · upscale(+unsharp)/psm4 · denoise(median)/psm6 · base/psm3
type PreVariant = "base" | "otsu" | "upscale" | "denoise";
interface Combo {
  variant: PreVariant;
  psm: number;
}
const OCR_COMBOS: Combo[] = [
  { variant: "base", psm: 6 },
  { variant: "otsu", psm: 6 },
  { variant: "upscale", psm: 4 },
  { variant: "denoise", psm: 6 },
  { variant: "base", psm: 3 }
];

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

/** تدرّج رمادي + autocontrast (نظير ImageOps.grayscale+autocontrast في زيني) */
function grayscaleAutocontrast(canvas: HTMLCanvasElement, cutoff = 2): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const gray = new Uint8Array(w * h);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0, g = 0; i < px.length; i += 4, g += 1) {
    const v = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
    gray[g] = v;
    hist[v] += 1;
  }
  // autocontrast: قصّ cutoff% من الطرفين ثم تمديد
  const total = w * h;
  const cut = Math.floor((total * cutoff) / 100);
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255; lo += 1) {
    acc += hist[lo];
    if (acc > cut) break;
  }
  for (let acc = 0; hi > 0; hi -= 1) {
    acc += hist[hi];
    if (acc > cut) break;
  }
  const range = hi - lo || 1;
  for (let i = 0, g = 0; i < px.length; i += 4, g += 1) {
    const v = Math.max(0, Math.min(255, ((gray[g] - lo) * 255) / range));
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** مرشّح متوسط 3×3 لإزالة التشويش (نظير MedianFilter(3) في زيني) */
function medianFilter3(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  const win = new Uint8Array(9);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          win[k++] = s[(yy * w + xx) * 4];
        }
      }
      win.sort();
      const m = win[4];
      const idx = (y * w + x) * 4;
      o[idx] = o[idx + 1] = o[idx + 2] = m;
      o[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** حدّة (unsharp mask مبسّطة) لإبراز حواف الحروف بعد التكبير */
function unsharp(canvas: HTMLCanvasElement, amount = 1.5): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { width: w, height: h } = canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const s = src.data;
  const out = ctx.createImageData(w, h);
  const o = out.data;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const idx = (y * w + x) * 4;
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const yy = Math.min(h - 1, Math.max(0, y + dy));
          const xx = Math.min(w - 1, Math.max(0, x + dx));
          sum += s[(yy * w + xx) * 4];
          n += 1;
        }
      }
      const blur = sum / n;
      const v = Math.max(0, Math.min(255, s[idx] + (s[idx] - blur) * amount));
      o[idx] = o[idx + 1] = o[idx + 2] = v;
      o[idx + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d");
  if (ctx) ctx.drawImage(src, 0, 0);
  return c;
}

/** يبني نسخة معالَجة من قماش أساس حسب الاستراتيجية (base/otsu/upscale/denoise) */
function buildVariant(baseCanvas: HTMLCanvasElement, variant: PreVariant): HTMLCanvasElement {
  const c = cloneCanvas(baseCanvas);
  if (variant === "base") return grayscaleAutocontrast(c);
  if (variant === "otsu") return preprocessCanvas(c); // عتبة Otsu ثنائية
  if (variant === "denoise") return grayscaleAutocontrast(medianFilter3(c));
  // upscale: تكبير 1.5× + autocontrast + unsharp (نظير زيني)
  const up = document.createElement("canvas");
  up.width = Math.round(c.width * 1.5);
  up.height = Math.round(c.height * 1.5);
  const uctx = up.getContext("2d");
  if (uctx) {
    uctx.imageSmoothingEnabled = true;
    uctx.imageSmoothingQuality = "high";
    uctx.drawImage(c, 0, 0, up.width, up.height);
  }
  return unsharp(grayscaleAutocontrast(up));
}

/**
 * OCR «أفضل من خمس محاولات» — نظير reocr_hard: يجرّب 5 استراتيجيات (base/otsu/
 * upscale/denoise × psm 6/4/3) ويختار الأعلى جودة بمعادلة زيني. عامل Tesseract
 * واحد يُعاد ضبط psm لكل محاولة. توقّف مبكر عند جودة ممتازة توفيراً للزمن.
 */
export async function ocrImageBest(
  source: Blob | HTMLCanvasElement | string,
  onProgress?: OcrProgress,
  opts?: { combos?: Combo[] }
): Promise<RecognizeResult & { strategy: string }> {
  const combos = opts?.combos ?? OCR_COMBOS;
  const base = await sourceToCanvas(source);
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
    let best = { text: "", confidence: 0, strategy: "", score: -Infinity };
    for (let i = 0; i < combos.length; i += 1) {
      const { variant, psm } = combos[i];
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: String(psm)
      } as unknown as Parameters<typeof worker.setParameters>[0]);
      let input: HTMLCanvasElement;
      try {
        input = buildVariant(base, variant);
      } catch {
        continue;
      }
      const { data } = await worker.recognize(input as Parameters<typeof worker.recognize>[0]);
      input.width = 0;
      input.height = 0;
      const text = (data.text ?? "").trim();
      const score = pageQualityScore(text);
      if (score > best.score) best = { text, confidence: data.confidence ?? 0, strategy: `${variant}/psm${psm}`, score };
      // توقّف مبكر: جودة ممتازة (≥88/100) تكفي — لا داعي لبقية المحاولات
      if (best.score >= 88) break;
    }
    return { text: best.text, confidence: best.confidence, strategy: best.strategy };
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
    const canvas = await renderPdfPageToCanvas(page);
    // «أفضل من عدّة محاولات» لكل صفحة — يختار الأعلى جودة (raw/otsu/upscale)
    const { text, confidence } = await ocrImageBest(canvas, (info) =>
      onProgress?.({ page: p, pages: doc.numPages, status: info.status, progress: info.progress })
    );
    confSum += confidence;
    parts.push(`[صفحة ${p}]\n${text}`);
    canvas.width = 0;
    canvas.height = 0;
  }
  await doc.destroy();
  const raw = parts.join("\n\n").trim();
  // عزل خربشة الشعار/الختم في الصفحة الأولى/الأخيرة (تبقى الترويسة النصية)
  const scrubbed = scrubLogoNoise(raw, doc.numPages);
  return { text: scrubbed, pages: doc.numPages, avgConfidence: doc.numPages ? confSum / doc.numPages : 0 };
}

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "bmp", "gif"];

export function isImageExtension(ext: string): boolean {
  return IMAGE_EXTENSIONS.includes(ext.toLowerCase());
}
