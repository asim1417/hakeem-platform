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
  /** الترويسات/التذييلات المتكررة عبر الصفحات — تُفصل كبيانات وصفية ولا تلوّث المتن */
  running?: string;
}

/**
 * كشف الترويسة/التذييل بالتكرار عبر الصفحات (وفق دليل المعالجة):
 * السطر الذي يتكرر في ≥60% من الصفحات قرب أولها أو آخرها ترويسة أو تذييل —
 * يُنقل لبيانات وصفية ويُنزع من المتن حفاظاً على نقاء البحث والفهرسة.
 * يعمل على نصوص PDF المقسّمة بعلامات [صفحة N].
 */
export function separateRunningLines(text: string): { body: string; running?: string } {
  const pages = text.split(/\[صفحة \d+\]\n?/).filter((p) => p.trim().length > 0);
  if (pages.length < 3) return { body: text };

  const ZONE = 3; // أسطر منطقة الترويسة/التذييل من كل طرف
  const tops = new Map<string, number>();
  const bots = new Map<string, number>();
  const pageLines = pages.map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean));
  for (const lines of pageLines) {
    for (const l of lines.slice(0, ZONE)) tops.set(l, (tops.get(l) ?? 0) + 1);
    for (const l of lines.slice(-ZONE)) bots.set(l, (bots.get(l) ?? 0) + 1);
  }
  const threshold = Math.ceil(0.6 * pages.length);
  const isRunning = (l: string) =>
    l.length >= 3 && ((tops.get(l) ?? 0) >= threshold || (bots.get(l) ?? 0) >= threshold);

  const found = new Set<string>();
  const cleanedPages = pageLines.map((lines) =>
    lines
      .filter((l, idx) => {
        const nearEdge = idx < ZONE || idx >= lines.length - ZONE;
        if (nearEdge && isRunning(l)) {
          found.add(l);
          return false;
        }
        return true;
      })
      .join("\n")
  );
  if (!found.size) return { body: text };
  return {
    body: cleanedPages.map((p, i) => `[صفحة ${i + 1}]\n${p}`).join("\n\n").trim(),
    running: Array.from(found).join("\n")
  };
}

/** تقدّم المعالجة الطويلة (OCR) — نص عربي جاهز للعرض */
export type ExtractProgress = (label: string) => void;

export interface ExtractOptions {
  onProgress?: ExtractProgress;
  /** قراءة سحابية عالية الدقة عبر Gemini (‏/api/doc-tool/ocr) — تُرسل الوثيقة للخادم؛
      عند الفشل أو عدم التفعيل نسقط تلقائياً للمعالجة المحلية */
  cloudOcr?: boolean;
}

const TEXT_EXTS = ["txt", "md", "csv", "json"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"];
const CLOUD_EXTS = ["png", "jpg", "jpeg", "pdf"];

/** يستخرج نص ملف بحسب صيغته — يعمل في المتصفح فقط */
export async function extractFile(
  file: File,
  optionsOrProgress?: ExtractOptions | ExtractProgress
): Promise<ExtractResult> {
  const opts: ExtractOptions =
    typeof optionsOrProgress === "function" ? { onProgress: optionsOrProgress } : optionsOrProgress ?? {};
  const onProgress = opts.onProgress;
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

  // المسار السحابي (اختياري صراحةً): Gemini يقرأ الصور وPDF بأنواعه
  if (opts.cloudOcr && CLOUD_EXTS.includes(ext)) {
    const cloud = await cloudOcr(file, onProgress);
    if (cloud) return cloud;
    onProgress?.("السحابي غير متاح — متابعة بالمعالجة المحلية…");
  }

  if (ext === "pdf") {
    return extractPdf(file, onProgress);
  }

  if (IMAGE_EXTS.includes(ext)) {
    return extractImage(file, onProgress);
  }

  return { text: "", kind: "صيغة غير مدعومة" };
}

async function cloudOcr(file: File, onProgress?: ExtractProgress): Promise<ExtractResult | null> {
  try {
    onProgress?.("قراءة سحابية عالية الدقة (Gemini)…");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/doc-tool/ocr", { method: "POST", body: fd });
    const json = (await res.json()) as { text?: string; error?: string };
    if (!res.ok || !json.text) return null;
    return { text: json.text, kind: file.name.toLowerCase().endsWith(".pdf") ? "PDF (Gemini)" : "صورة (Gemini)" };
  } catch {
    return null;
  }
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
    const sep = separateRunningLines(result.text);
    return { text: sep.body, kind: "PDF (نص)", warning, running: sep.running };
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
  const sep = separateRunningLines(fixed.text);
  return { text: sep.body, kind: `PDF ممسوح (OCR ${Math.round(avgConfidence)}٪)`, running: sep.running };
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
