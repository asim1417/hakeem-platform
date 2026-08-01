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

// كشف الترويسة/التذييل نُقل إلى النواة المحايدة للبيئة (document-inspection/reshape)
// ليعمل في المتصفح والخادم معاً. يُستورد محلياً (للاستخدام الداخلي) ويُعاد تصديره
// للتوافق مع المستوردين الحاليين (conversion-manager, CaseBrowser).
import { separateRunningLines } from "@/lib/modules/document-inspection/reshape";
export { separateRunningLines };

/** تقدّم المعالجة الطويلة (OCR) — نص عربي جاهز للعرض */
export type ExtractProgress = (label: string) => void;

export interface ExtractOptions {
  onProgress?: ExtractProgress;
  /** قراءة سحابية عالية الدقة عبر Gemini (‏/api/doc-tool/ocr) — تُرسل الوثيقة للخادم؛
      عند الفشل أو عدم التفعيل نسقط تلقائياً للمعالجة المحلية */
  cloudOcr?: boolean;
  /** نطاق صفحات للقراءة السحابية للـ PDF (شامل الطرفين) */
  cloudRange?: { from?: number; to?: number };
  /** نموذج القراءة السحابية: lite (الأسرع للمطبوع النظيف) · flash (عادي) · pro (خطّ
      يدوي/أختام/وثائق صعبة). الافتراضي lite مع تصعيدٍ تلقائيّ للصفحة الضعيفة. */
  cloudModel?: "lite" | "flash" | "pro";
  /** بثّ لكل صفحة سحابية عند اكتمالها — لعرضٍ تدريجيّ (أوّل صفحة في ثانية) بدل انتظار الكلّ. */
  onPage?: (pageNumber: number, text: string, fromCache: boolean) => void;
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
    const { result: cloud, error: cloudError } = await cloudOcr(file, onProgress, opts.cloudRange, opts.cloudModel, opts.onPage);
    if (cloud) return cloud;
    onProgress?.(cloudError ? `⚠ ${cloudError} — متابعة بالمعالجة المحلية…` : "السحابي غير متاح — متابعة بالمعالجة المحلية…");
  }

  if (ext === "pdf") {
    return extractPdf(file, onProgress);
  }

  if (IMAGE_EXTS.includes(ext)) {
    return extractImage(file, onProgress);
  }

  return { text: "", kind: "صيغة غير مدعومة" };
}

async function cloudOcr(
  file: File,
  onProgress?: ExtractProgress,
  range?: { from?: number; to?: number },
  model?: "lite" | "flash" | "pro",
  onPage?: (pageNumber: number, text: string, fromCache: boolean) => void
): Promise<{ result: ExtractResult | null; error?: string }> {
  const { cloudOcrImage, cloudOcrPdfPages } = await import("@/lib/modules/doc-tool/cloud-ocr");
  const tag = model === "pro" ? "Gemini pro" : "Gemini";
  if (file.name.toLowerCase().endsWith(".pdf")) {
    // صفحات كصور — رؤية حقيقية تتجاوز طبقات النص المعطوبة (الترتيب البصري)
    const result = await cloudOcrPdfPages(await file.arrayBuffer(), onProgress, { ...(range ?? {}), model, onPage });
    if (!result.text) return { result: null, error: result.error };
    const sep = separateRunningLines(result.text);
    const ranged = range?.from || range?.to ? ` · ص ${range.from ?? 1}–${range.to ?? result.total}` : "";
    return {
      result: {
        text: sep.body,
        kind: `PDF (${tag}${ranged})`,
        running: sep.running,
        warning: result.failed.length
          ? `تعذّرت ${result.failed.length} صفحة — افتح الوثيقة واضغط «أعد قراءة المتعذر»`
          : undefined
      }
    };
  }
  const { text, error } = await cloudOcrImage(file, onProgress, model);
  if (!text) return { result: null, error };
  return { result: { text, kind: `صورة (${tag})` } };
}

async function extractPdf(file: File, onProgress?: ExtractProgress): Promise<ExtractResult> {
  // لقطةٌ واحدة للبايتات، ثمّ نسخةٌ جديدة لكلّ مستهلِك: pdf.js يُحوّل (يفصل) الـArrayBuffer
  // الذي يستقبله، فإعادة استخدام نفس المرجع لاحقًا تُسبّب «Buffer is already detached».
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fresh = (): ArrayBuffer => bytes.slice().buffer;
  try {
    const { isPageLevelOcrV1Enabled } = await import("@/lib/modules/doc-tool/flags");
    if (isPageLevelOcrV1Enabled()) {
      const perPage = await extractPdfPerPage(fresh, onProgress);
      if (perPage) return perPage;
      // perPage=null يعني تعذّر التخطيط (مثلاً ملف تالف) — نسقط للمسار القديم أدناه
    }
    const { extractPdfText } = await import("@/lib/modules/document-inspection/file-extract");
    onProgress?.("قراءة نص الـ PDF…");
    const result = await extractPdfText(fresh());
    // ممسوح بالكامل أو طبقة نص معطوبة → OCR على صور كل الصفحات
    if (result.emptyPages >= result.pages || result.needsOcr) {
      return ocrPdf(fresh(), onProgress);
    }
    // مسح جزئي: بعض الصفحات نصّ سليم وبعضها صور — اقرأ الممسوحة فقط ضوئياً وادمجها،
    // فلا تبقى صفحاتٌ فارغةً صامتةً في المخرجات.
    if (result.emptyPageNumbers.length) {
      const { ocrScannedPdf, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
      const { fixReversedArabicLines } = await import("@/lib/modules/document-inspection/text-quality");
      const { mergeScannedPages } = await import("@/lib/modules/document-inspection/file-extract");
      onProgress?.("قراءة الصفحات الممسوحة ضوئياً…");
      const ocr = await ocrScannedPdf(
        fresh(),
        (info) =>
          onProgress?.(
            `OCR صفحة ${info.page}/${info.pages} — ${translateOcrStatus(info.status)} ${Math.round((info.progress || 0) * 100)}٪`
          ),
        { onlyPages: result.emptyPageNumbers }
      );
      const fixed = fixReversedArabicLines(ocr.text);
      const merged = mergeScannedPages(result.text, fixed.text);
      const sep = separateRunningLines(merged);
      return { text: sep.body, kind: `PDF مختلط (نص + OCR ${Math.round(ocr.avgConfidence)}٪)`, running: sep.running };
    }
    const sep = separateRunningLines(result.text);
    return { text: sep.body, kind: "PDF (نص)", running: sep.running };
  } catch (err) {
    // فشل فك النص (ملف صور خالص مثلاً) — جرّب OCR قبل الاستسلام
    try {
      return await ocrPdf(fresh(), onProgress);
    } catch {
      return { text: "", kind: `تعذّر (${errMsg(err)})` };
    }
  }
}

/**
 * توجيه OCR على مستوى الصفحة (خلف علم NEXT_PUBLIC_HAKEEM_PAGE_LEVEL_OCR_V1).
 * يُخطّط لكل صفحة: النظيفة تُقرأ من طبقة النصّ، والفارغة/المعطوبة/المُفسَدة دلاليًّا
 * تُقرأ ضوئيًّا وتُدمَج في محلّها — بدل إرسال المستند كلّه إلى OCR لأجل صفحةٍ واحدة.
 * يعيد null عند تعذّر التخطيط ليسقط النداء إلى المسار القديم.
 */
async function extractPdfPerPage(
  fresh: () => ArrayBuffer,
  onProgress?: ExtractProgress
): Promise<ExtractResult | null> {
  const { planPdfPageOcr, mergeScannedPages } = await import("@/lib/modules/document-inspection/file-extract");
  onProgress?.("قراءة نص الـ PDF صفحةً صفحة…");
  let plan;
  try {
    plan = await planPdfPageOcr(fresh());
  } catch {
    return null; // تعذّر فتح/تخطيط الملف — دع المسار القديم يحاول (قد ينجح OCR كامل)
  }
  // كل الصفحات نصّ رقميّ سليم → لا حاجة لأيّ OCR
  if (plan.needOcrPages.length === 0) {
    const sep = separateRunningLines(plan.baseText);
    return { text: sep.body, kind: "PDF (نص)", running: sep.running };
  }
  // كل الصفحات تحتاج OCR (ممسوح بالكامل أو طبقة نصّ معطوبة تمامًا) → OCR كامل
  if (plan.cleanPages === 0) {
    return ocrPdf(fresh(), onProgress);
  }
  // مختلط: اقرأ ضوئيًّا الصفحات المحتاجة فقط وادمجها في النصّ الرقميّ السليم
  const { ocrScannedPdf, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
  const { fixReversedArabicLines } = await import("@/lib/modules/document-inspection/text-quality");
  onProgress?.(`قراءة ${plan.needOcrPages.length} صفحة محتاجة للمسح…`);
  const ocr = await ocrScannedPdf(
    fresh(),
    (info) =>
      onProgress?.(
        `OCR صفحة ${info.page}/${info.pages} — ${translateOcrStatus(info.status)} ${Math.round((info.progress || 0) * 100)}٪`
      ),
    { onlyPages: plan.needOcrPages }
  );
  const fixed = fixReversedArabicLines(ocr.text);
  const merged = mergeScannedPages(plan.baseText, fixed.text);
  const sep = separateRunningLines(merged);
  return {
    text: sep.body,
    kind: `PDF مختلط (نص + OCR ${Math.round(ocr.avgConfidence)}٪ · ${plan.cleanPages} نصّ · ${plan.needOcrPages.length} مسح)`,
    running: sep.running
  };
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
    const { ocrImageBest, translateOcrStatus } = await import("@/lib/modules/document-inspection/ocr");
    const { fixReversedArabicLines } = await import("@/lib/modules/document-inspection/text-quality");
    onProgress?.("تحضير القراءة الضوئية…");
    const { text, confidence } = await ocrImageBest(file, (info) =>
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
