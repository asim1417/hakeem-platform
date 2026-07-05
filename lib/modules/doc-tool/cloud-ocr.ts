// القراءة السحابية (Gemini) من جهة العميل — مشتركة بين البحث السريع ومحطة العمل.
//
// درس مستفاد من وثائق فعلية: إرسال ملف PDF كاملاً إلى Gemini يجعله يقرأ «طبقة النص»
// المدفونة فيه إن وُجدت — وطبقات InDesign العربية كثيراً ما تكون بترتيب العرض البصري
// (كلمات مبعثرة الأجزاء: الزتامات/الرشكة/عــ ىل) فيرث السحابي عطبها. الحل الجذري هنا:
// نحوّل كل صفحة إلى صورة في المتصفح ثم نرسل الصور — فيُجبر Gemini على الرؤية الحقيقية.
//
// السرعة: تفريغ متوازٍ (3 صفحات معاً افتراضاً) يهبط تلقائياً إلى التتابع عند ملامسة
// حد المعدل (429) مع إعادة محاولة بانتظار متزايد — يناسب المفاتيح المجانية والمدفوعة معاً.

export type CloudProgress = (label: string) => void;

/** علامة الصفحة المتعذرة في النص — تُستخدم لاحقاً لإعادة قراءتها وحدها */
export const CLOUD_PAGE_FAILED = "(تعذّرت قراءة هذه الصفحة سحابياً)";

/** حد جسم الطلب الواحد (Vercel ~4.5MB وbase64 يضخّم) */
const MAX_UPLOAD_BYTES = 3_400_000;
/** دقة تحويل الصفحة لصورة — 2 كافية لرؤية Gemini (المحلي يستخدم 3 لأن Tesseract يتطلب دقة أعلى) */
const PAGE_SCALE = 2;
const JPEG_QUALITY = 0.87;
/** التوازي الافتراضي — يهبط إلى 1 تلقائياً عند أول 429 */
const DEFAULT_CONCURRENCY = 3;
/** انتظارات إعادة المحاولة عند حد المعدل */
const RATE_WAITS_MS = [15_000, 30_000];

interface PostResult {
  text: string | null;
  rateLimited: boolean;
}

async function postToCloud(blob: Blob, name: string): Promise<PostResult> {
  try {
    if (blob.size > MAX_UPLOAD_BYTES) return { text: null, rateLimited: false };
    const fd = new FormData();
    fd.append("file", new File([blob], name, { type: blob.type || "application/octet-stream" }));
    const res = await fetch("/api/doc-tool/ocr", { method: "POST", body: fd });
    if (res.status === 429) return { text: null, rateLimited: true };
    const json = (await res.json()) as { text?: string };
    if (!res.ok || !json.text || json.text.trim().length < 3) return { text: null, rateLimited: false };
    return { text: json.text.trim(), rateLimited: false };
  } catch {
    return { text: null, rateLimited: false };
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** قراءة صورة (ملف مرفوع) سحابياً */
export async function cloudOcrImage(file: File, onProgress?: CloudProgress): Promise<string | null> {
  onProgress?.("قراءة سحابية فائقة الدقة (Gemini)…");
  const r = await postToCloud(file, file.name);
  if (r.rateLimited) {
    for (const wait of RATE_WAITS_MS) {
      onProgress?.(`حد المعدل — انتظار ${wait / 1000} ثانية…`);
      await sleep(wait);
      const retry = await postToCloud(file, file.name);
      if (retry.text) return retry.text;
      if (!retry.rateLimited) break;
    }
  }
  return r.text;
}

export interface CloudPdfOptions {
  /** نطاق صفحات اختياري (شامل الطرفين، يبدأ من 1) */
  from?: number;
  to?: number;
  /** صفحات محددة فقط — لإعادة قراءة المتعذر */
  onlyPages?: number[];
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
}

/**
 * قراءة PDF سحابياً — صفحاتٍ كصور مرسومة في المتصفح (رؤية حقيقية، لا طبقة نص).
 * متوازية تكيفياً، وتدعم نطاقاً أو قائمة صفحات محددة. null إن لم تُقرأ أي صفحة.
 */
export async function cloudOcrPdfPages(
  buffer: ArrayBuffer,
  onProgress?: CloudProgress,
  opts: CloudPdfOptions = {}
): Promise<CloudPdfResult | null> {
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
      return null;
    }

    const results = new Map<number, string | null>();
    let cursor = 0;
    let done = 0;
    let limitHit = false; // بعد أول 429: يعمل عامل واحد فقط (تتابع)

    const readPage = async (p: number): Promise<string | null> => {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: PAGE_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", JPEG_QUALITY)
      );
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) return null;

      let attempt = await postToCloud(blob, `page-${p}.jpg`);
      let waitIdx = 0;
      while (attempt.rateLimited && waitIdx < RATE_WAITS_MS.length) {
        limitHit = true;
        onProgress?.(`حد المعدل — انتظار ${RATE_WAITS_MS[waitIdx] / 1000} ثانية ثم إعادة صفحة ${p}…`);
        await sleep(RATE_WAITS_MS[waitIdx]);
        waitIdx += 1;
        attempt = await postToCloud(blob, `page-${p}.jpg`);
      }
      if (attempt.rateLimited) limitHit = true;
      return attempt.text;
    };

    const worker = async (id: number) => {
      for (;;) {
        if (limitHit && id > 0) return; // انكماش التوازي عند حد المعدل
        const i = cursor;
        cursor += 1;
        if (i >= pages.length) return;
        const p = pages[i];
        onProgress?.(`قراءة سحابية (Gemini) — ${done}/${pages.length} · صفحة ${p}…`);
        results.set(p, await readPage(p));
        done += 1;
        onProgress?.(`قراءة سحابية (Gemini) — ${done}/${pages.length} صفحة`);
      }
    };

    const poolSize = Math.min(DEFAULT_CONCURRENCY, pages.length);
    await Promise.all(Array.from({ length: poolSize }, (_, i) => worker(i)));
    await doc.destroy();

    const failed = pages.filter((p) => !results.get(p));
    if (failed.length === pages.length) return null; // فشل شامل → المستدعي يسقط للمحلي

    const text = pages
      .map((p) => `[صفحة ${p}]\n${results.get(p) ?? CLOUD_PAGE_FAILED}`)
      .join("\n\n")
      .trim();
    return { text, failed, requested: pages.length, total };
  } catch {
    return null;
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
