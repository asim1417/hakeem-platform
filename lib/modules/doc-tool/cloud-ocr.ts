// القراءة السحابية (Gemini) من جهة العميل — مشتركة بين البحث السريع ومحطة العمل.
//
// درس مستفاد من وثائق فعلية: إرسال ملف PDF كاملاً إلى Gemini يجعله يقرأ «طبقة النص»
// المدفونة فيه إن وُجدت — وطبقات InDesign العربية كثيراً ما تكون بترتيب العرض البصري
// (كلمات مبعثرة الأجزاء: الزتامات/الرشكة/عــ ىل) فيرث السحابي عطبها. الحل الجذري هنا:
// نحوّل كل صفحة إلى صورة في المتصفح ثم نرسل الصور — فيُجبر Gemini على الرؤية الحقيقية.
//
// السرعة: تفريغ متوازٍ (3 صفحات معاً افتراضاً) يهبط تلقائياً إلى التتابع عند ملامسة
// حد المعدل (429) مع إعادة محاولة بانتظار متزايد — يناسب المفاتيح المجانية والمدفوعة معاً.

import { runAdaptive } from "@/lib/modules/document-inspection/throughput";

export type CloudProgress = (label: string) => void;

/** علامة الصفحة المتعذرة في النص — تُستخدم لاحقاً لإعادة قراءتها وحدها */
export const CLOUD_PAGE_FAILED = "(تعذّرت قراءة هذه الصفحة سحابياً)";

/** حد جسم الطلب الواحد (Vercel ~4.5MB وbase64 يضخّم) */
const MAX_UPLOAD_BYTES = 3_400_000;

/**
 * ترميز صفحةٍ ملوّنة بأعلى جودةٍ تسعُها حدودُ الطلب. لا نُحوّلها تدرّجاً رمادياً ولا
 * نُعتّبها: نماذج الرؤية (Gemini) دُرِّبت على صورٍ ملوّنة طبيعية، وإزالة اللون/سحق
 * التباين تُفقدها معلوماتٍ (أختام وترويسات ملوّنة، فصل الحبر عن الخلفية) فتنخفض الدقّة.
 * نبدأ بجودة JPEG عالية وننزل تدريجياً حتى نلائم الحدّ — بلا فقدٍ محسوس للنصّ.
 */
async function encodeToFit(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const encode = (q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), "image/jpeg", q));
  for (const q of [0.95, 0.9, 0.85, 0.8]) {
    const blob = await encode(q);
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
    if (q === 0.8) return blob; // آخر محاولة — يرفضها postToCloud إن تجاوزت الحدّ
  }
  return null;
}
/** دقة تحويل الصفحة لصورة. 2 يكفي رؤية Gemini (تُصغّر الصور داخلياً إلى بلاطات
 *  محدودة، فـ3 يضخّم الرفع بلا مكسب) ويُنصّف بايتات الرفع — أسرع بلا فقدٍ محسوس. */
const PAGE_SCALE = 2;
/** التوازي الافتراضي (بدايةٌ للجدولة المتكيّفة) — تُشبع حدّ المفتاح ثم تتراجع. */
const DEFAULT_CONCURRENCY = 6;
/** انتظارات إعادة المحاولة لمسار الصورة المفردة (مع مهلة Google الحقيقية عند توفّرها). */
const RATE_WAITS_MS = [15_000, 30_000];
/** تهدئة مشتركة متزايدة للجدولة المتكيّفة في مسار الـ PDF — قابلة للتعافي عند النجاح. */
const RATE_BACKOFFS_MS = [4_000, 8_000, 16_000];

interface PostResult {
  text: string | null;
  rateLimited: boolean;
  /** حصة يومية مستهلَكة (RPD) — لا طائل من إعادة المحاولة اليوم، بخلاف حدّ الدقيقة العابر */
  dailyLimitExceeded?: boolean;
  /** مهلة الانتظار الحقيقية التي أرسلها Google (RetryInfo) — أدقّ من تخمين ثابت */
  retryDelaySec?: number | null;
  /** السبب الحقيقي عند الفشل — يُعرض للمستخدم بدل رسالة عامة */
  error?: string;
}

async function postToCloud(blob: Blob, name: string, model?: "flash" | "pro"): Promise<PostResult> {
  try {
    if (blob.size > MAX_UPLOAD_BYTES) {
      return { text: null, rateLimited: false, error: "حجم الصفحة يتجاوز حدّ الرفع السحابي" };
    }
    const fd = new FormData();
    fd.append("file", new File([blob], name, { type: blob.type || "application/octet-stream" }));
    if (model) fd.append("model", model);
    const res = await fetch("/api/doc-tool/ocr", { method: "POST", body: fd });
    const json = (await res.json().catch(() => ({}))) as {
      text?: string;
      error?: string;
      dailyLimitExceeded?: boolean;
      retryDelaySec?: number;
    };
    if (res.status === 429) {
      return {
        text: null,
        rateLimited: !json.dailyLimitExceeded,
        dailyLimitExceeded: json.dailyLimitExceeded,
        retryDelaySec: json.retryDelaySec ?? null,
        error: json.error
      };
    }
    if (!res.ok || !json.text || json.text.trim().length < 3) {
      return { text: null, rateLimited: false, error: json.error ?? `Gemini أعاد ${res.status}` };
    }
    return { text: json.text.trim(), rateLimited: false };
  } catch {
    return { text: null, rateLimited: false, error: "تعذّر الاتصال بخدمة القراءة السحابية" };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ينتظر بمدّة `ms` مُبلّغاً عن الثواني المتبقية كل ثانية — بدل رسالة تقدّمٍ ثابتة
 * تُعلَن مرّةً واحدة وتتجمّد طوال الانتظار (كانت تُظهر "15 ثانية" حتى لحظة الانتهاء).
 */
async function sleepWithCountdown(ms: number, onTick: (remainingSec: number) => void): Promise<void> {
  let remaining = Math.round(ms / 1000);
  while (remaining > 0) {
    onTick(remaining);
    await sleep(1000);
    remaining -= 1;
  }
}

/**
 * يُلائم صورةً مرفوعة لحدّ الرفع: الصور الكبيرة (صور الجوّال 4–12MB) كانت تُرفض صامتةً.
 * الحلّ: إن تجاوزت الحدّ (أو لم تكن JPEG/PNG) نُصغّرها إلى حدٍّ أقصى للبُعد يكفي رؤية
 * Gemini ثم نرمّزها بجودةٍ مُلائمة. الصغيرة المقبولة تُرسَل كما هي بلا مساس.
 */
async function fitImageForCloud(file: File): Promise<{ blob: Blob; name: string } | null> {
  if (file.size <= MAX_UPLOAD_BYTES && /image\/(jpe?g|png)/i.test(file.type)) {
    return { blob: file, name: file.name };
  }
  try {
    const bmp = await createImageBitmap(file);
    const MAX_SIDE = 3000; // يكفي دقّةَ رؤية Gemini ويحدّ الحجم
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      return file.size <= MAX_UPLOAD_BYTES ? { blob: file, name: file.name } : null;
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await encodeToFit(canvas);
    canvas.width = 0;
    canvas.height = 0;
    return blob ? { blob, name: "image.jpg" } : null;
  } catch {
    return file.size <= MAX_UPLOAD_BYTES ? { blob: file, name: file.name } : null;
  }
}

export interface CloudImageResult {
  text: string | null;
  /** السبب الحقيقي عند الفشل (مفتاح، حصة يومية، شبكة، ...) — لا يظهر إلا عند text=null */
  error?: string;
}

/** ينتقي مهلة الانتظار: الحقيقية من Google (RetryInfo) إن وُجدت، وإلا التخمين الثابت */
function waitMsFor(attempt: PostResult, fallbackMs: number): number {
  if (!attempt.retryDelaySec) return fallbackMs;
  return Math.min(Math.max(Math.round(attempt.retryDelaySec * 1000), 3_000), 60_000);
}

/** قراءة صورة (ملف مرفوع) سحابياً */
export async function cloudOcrImage(file: File, onProgress?: CloudProgress, model?: "flash" | "pro"): Promise<CloudImageResult> {
  onProgress?.(model === "pro" ? "قراءة سحابية فائقة الدقة (Gemini Pro)…" : "قراءة سحابية فائقة الدقة (Gemini)…");
  const fitted = await fitImageForCloud(file);
  if (!fitted) return { text: null, error: "تعذّر تحضير الصورة لحدّ الرفع السحابي" };
  let attempt = await postToCloud(fitted.blob, fitted.name, model);
  if (attempt.dailyLimitExceeded) return { text: null, error: attempt.error };
  if (attempt.rateLimited) {
    for (const wait of RATE_WAITS_MS) {
      const waitMs = waitMsFor(attempt, wait);
      await sleepWithCountdown(waitMs, (remaining) => onProgress?.(`حد المعدل — انتظار ${remaining} ثانية…`));
      attempt = await postToCloud(fitted.blob, fitted.name, model);
      if (attempt.text) return { text: attempt.text };
      if (attempt.dailyLimitExceeded) return { text: null, error: attempt.error };
      if (!attempt.rateLimited) break;
    }
  }
  return { text: attempt.text, error: attempt.text ? undefined : attempt.error };
}

export interface CloudPdfOptions {
  /** نطاق صفحات اختياري (شامل الطرفين، يبدأ من 1) */
  from?: number;
  to?: number;
  /** صفحات محددة فقط — لإعادة قراءة المتعذر */
  onlyPages?: number[];
  /** النموذج: flash (اقتصادي) أو pro (دقة قصوى — VIP) */
  model?: "flash" | "pro";
  /** درجة التوازي المطلوبة — للمفاتيح المدفوعة (حدّ معدلٍ أعلى). يهبط تلقائياً عند 429. */
  concurrency?: number;
  /** إلغاء تعاوني — تتوقف الحلقة عند أول صفحة تالية */
  shouldCancel?: () => boolean;
}

/** أقصى توازٍ مسموح في المتصفح — سقفُ أمانِ ذاكرةٍ (كل صفحةٍ طائرة تُرسَم كـ canvas
 *  كبير). الجدولة المتكيّفة ترفع التوازي تدريجياً حتى هذا السقف أو حتى يُلامَس حدّ
 *  المعدل. الإنتاجية الأعلى (1000 صفحة) محلّها الخادم بلا قيد ذاكرة المتصفح. */
export const MAX_CONCURRENCY = 12;

/** عدد صفحات ملف PDF (للتقدير المسبق قبل بدء الدفعة) */
export async function getPdfPageCount(buffer: ArrayBuffer): Promise<number> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const n = doc.numPages;
    await doc.destroy();
    return n;
  } catch {
    return 0;
  }
}

export interface CloudPdfResult {
  /** النص موحّداً بعلامات [صفحة N] */
  text: string;
  /** أرقام الصفحات التي تعذّرت قراءتها */
  failed: number[];
  /** عدد الصفحات المطلوبة */
  requested: number;
  /** إجمالي صفحات الملف */
  total: number;
  /** السبب الحقيقي عند فشل القراءة كلياً (text فارغ) — مفتاح، حصة يومية، شبكة... */
  error?: string;
}

/**
 * قراءة PDF سحابياً — صفحاتٍ كصور مرسومة في المتصفح (رؤية حقيقية، لا طبقة نص).
 * متوازية تكيفياً، وتدعم نطاقاً أو قائمة صفحات محددة. عند فشل القراءة كلياً يعود
 * text فارغاً مع error يحمل السبب الحقيقي — المستدعي يسقط للمحلي مع عرض السبب.
 */
export async function cloudOcrPdfPages(
  buffer: ArrayBuffer,
  onProgress?: CloudProgress,
  opts: CloudPdfOptions = {}
): Promise<CloudPdfResult> {
  try {
    onProgress?.("تجهيز صفحات الـ PDF للقراءة السحابية…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const total = doc.numPages;

    let pages: number[];
    if (opts.onlyPages?.length) {
      pages = opts.onlyPages.filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    } else {
      const from = Math.max(1, Math.min(opts.from ?? 1, total));
      const to = Math.max(from, Math.min(opts.to ?? total, total));
      pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    }
    if (!pages.length) {
      await doc.destroy();
      return { text: "", failed: [], requested: 0, total, error: "لا صفحات ضمن النطاق المحدَّد" };
    }

    const results = new Map<number, string | null>();
    let dailyBlocked = false; // حصة يومية مستهلَكة — توقّف الكل فوراً، لا طائل من الإعادة
    let lastError: string | undefined;

    // يرسم صفحةً ويرفعها؛ يعيد إشارة حدّ المعدل للجدولة المتكيّفة (لا تراجع يدوي هنا).
    // ويكتشف نفاد الحصة اليومية فيوقف الكلّ عبر إشارة الإلغاء (لا طائل من الإعادة اليوم).
    const renderAndPost = async (p: number): Promise<{ value: string | null; rateLimited: boolean }> => {
      if (dailyBlocked) return { value: null, rateLimited: false };
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: PAGE_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return { value: null, rateLimited: false };
      await page.render({ canvasContext: ctx, viewport }).promise;
      // نرسل الصفحة ملوّنةً كما رُسمت (بلا تدرّج رمادي/تعتيب) بأعلى جودةٍ تسعُها الحدود.
      const blob = await encodeToFit(canvas);
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) return { value: null, rateLimited: false };
      const attempt = await postToCloud(blob, `page-${p}.jpg`, opts.model);
      if (attempt.dailyLimitExceeded) {
        dailyBlocked = true; // يوقف الجدولة عبر signal أدناه
        lastError = attempt.error;
        return { value: null, rateLimited: false };
      }
      if (!attempt.text && attempt.error) lastError = attempt.error;
      return { value: attempt.text, rateLimited: attempt.rateLimited };
    };

    // جدولةٌ متكيّفة (AIMD): ترفع التوازي حتى يُشبَع حدّ المعدل ثم تتراجع وتتعافى —
    // فتُنجز كأقصى ما يسمح به المفتاح، بلا انهيارٍ دائم ولا فقدِ صفحة (إعادة جدولة).
    // تتوقّف عند إلغاء المستخدم أو نفاد الحصة اليومية.
    const start = Math.max(1, Math.min(opts.concurrency ?? DEFAULT_CONCURRENCY, MAX_CONCURRENCY));
    const pageResults = await runAdaptive(pages, (p) => renderAndPost(p), {
      start,
      max: MAX_CONCURRENCY,
      min: 1,
      cooldownMs: RATE_BACKOFFS_MS,
      signal: () => Boolean(opts.shouldCancel?.()) || dailyBlocked,
      onProgress: (d, t, c) => onProgress?.(`قراءة سحابية (Gemini) — ${d}/${t} صفحة · توازٍ ${c}`)
    });
    pages.forEach((p, i) => results.set(p, pageResults[i]));
    await doc.destroy();

    const failed = pages.filter((p) => !results.get(p));
    if (failed.length === pages.length) {
      return { text: "", failed, requested: pages.length, total, error: lastError ?? "تعذّرت قراءة كل الصفحات سحابياً" };
    }

    const text = pages
      .map((p) => `[صفحة ${p}]\n${results.get(p) ?? CLOUD_PAGE_FAILED}`)
      .join("\n\n")
      .trim();
    return { text, failed, requested: pages.length, total };
  } catch (err) {
    return {
      text: "",
      failed: [],
      requested: 0,
      total: 0,
      error: err instanceof Error ? err.message : "تعذّر تحضير الملف للقراءة السحابية"
    };
  }
}

/** أرقام الصفحات المعلَّمة متعذرةً داخل نص محفوظ */
export function extractFailedPages(text: string): number[] {
  const failed: number[] = [];
  const marker = CLOUD_PAGE_FAILED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\[صفحة (\\d+)\\]\\n${marker}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) failed.push(Number(m[1]));
  return failed;
}

/** يدمج نص الصفحات المُعاد قراءتها في النص الأصلي محل علامات التعذر */
export function mergeRetriedPages(original: string, retriedText: string): string {
  const blocks = new Map<number, string>();
  const re = /\[صفحة (\d+)\]\n([\s\S]*?)(?=\n\n\[صفحة |$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(retriedText))) {
    const body = m[2].trim();
    if (body && body !== CLOUD_PAGE_FAILED) blocks.set(Number(m[1]), body);
  }
  let out = original;
  for (const [p, body] of blocks) {
    out = out.replace(`[صفحة ${p}]\n${CLOUD_PAGE_FAILED}`, `[صفحة ${p}]\n${body}`);
  }
  return out;
}
