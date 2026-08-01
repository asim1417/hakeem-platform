// استخراج النص على الخادم (Node) — يعيد استخدام النواة المشتركة نفسها.
//
// نصوص وJSON: فكّ ترميز مباشر. Word: إعادة استخدام extractDocxText (يعمل على Node
// عبر DecompressionStream المدمج). PDF نصّي: pdfjs-dist. الممسوح/الصور: تُفوَّض
// لمحرّكٍ بعيد (Gemini/QARI) عبر السجلّ — فلا OCR ثقيل على معالج الخادم.
//
// كل نصٍّ مُستخرَج يمرّ عبر الدماغ الموحّد processExtractedText — نفس معالجة المتصفح.

import { extractDocxText } from "@/lib/modules/document-inspection/file-extract";
import { processExtractedText } from "@/lib/modules/document-inspection";
import { cleanPdfTextLayer } from "@/lib/modules/document-inspection/reshape";

export interface ExtractOut {
  text: string;
  kind: string;
}

const SCANNED_MARK = "[[صفحة تحتاج مسحًا ضوئيًّا]]";

function pageLevelEnabled(): boolean {
  const v = (process.env.HAKEEM_DOC_NODE_PAGE_LEVEL_V1 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/**
 * خطّةٌ لكل صفحة على الخادم: الصفحات النظيفة بنصّها الرقميّ، والفارغة/المعطوبة بعلامة
 * مسحٍ ضوئيّ — فيُرسَل إلى المحرّك البعيد ما يحتاجه فقط، لا الكتاب كلّه لأجل صفحةٍ واحدة.
 */
export interface PdfPagePlan {
  total: number;
  /** أرقام الصفحات (1-based) المحتاجة قراءةً ضوئية */
  needOcrPages: number[];
  /** جسمُ كل صفحة مرتّبًا (index = رقم الصفحة − 1): نصّ نظيف أو SCANNED_MARK */
  pageBodies: string[];
}

const TEXT_EXT = new Set([".txt", ".md", ".csv", ".json"]);

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.[^.]+$/);
  return m ? m[0] : "";
}

/** استخراج نصّ PDF رقمي عبر pdfjs على Node (بلا worker متصفح). */
async function extractPdfTextNode(data: Uint8Array): Promise<{ text: string; arabicChars: number }> {
  // البناء legacy يعمل في بيئة Node (بلا DOM). لا نضبط workerSrc — pdfjs يعمل بلا عامل.
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    parts.push(`[صفحة ${p}]\n${pageText.length < 10 ? "" : pageText}`);
  }
  await doc.destroy();
  const text = parts.join("\n\n").trim();
  const arabicChars = (text.match(/[ؠ-ي]/g) ?? []).length;
  return { text, arabicChars };
}

/** خطّةٌ لكل صفحة عبر pdfjs على Node: تصنيفٌ نظيف/محتاج-مسح لكل صفحة. */
async function planPdfPagesNode(data: Uint8Array): Promise<PdfPagePlan> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise;
  const total = doc.numPages;
  const needOcrPages: number[] = [];
  const pageBodies: string[] = [];
  for (let p = 1; p <= total; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const raw = content.items
      .map((it: any) => ("str" in it ? it.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (raw.length < 10) {
      needOcrPages.push(p);
      pageBodies.push(SCANNED_MARK);
      continue;
    }
    const cleaned = cleanPdfTextLayer(raw);
    if (cleaned.needsOcr) {
      needOcrPages.push(p);
      pageBodies.push(SCANNED_MARK);
    } else {
      pageBodies.push(cleaned.text);
    }
  }
  await doc.destroy();
  return { total, needOcrPages, pageBodies };
}

/**
 * يستخرج نصّ ملفٍ محلياً على الخادم ثم يمرّره عبر الدماغ الموحّد. للـ PDF الممسوح
 * أو الصور (لا طبقة نصّ) يرمي RemoteNeeded ليوجّهه المُوزّع لمحرّكٍ بعيد. عند تفعيل
 * التوجيه على مستوى الصفحة يحمل RemoteNeeded خطّةً (plan) للحالة المختلطة، فيُقرأ
 * ضوئيًّا ما يحتاجه فقط ويُدمَج في النصّ الرقميّ السليم.
 */
export class RemoteNeeded extends Error {
  plan?: PdfPagePlan;
  constructor(message?: string, plan?: PdfPagePlan) {
    super(message);
    this.plan = plan;
  }
}

/**
 * يدمج نصوص الصفحات المقروءة ضوئيًّا (page→text) في أجسام الخطّة، ثم يبني النصّ
 * بعلامات [صفحة N]. الصفحات المحتاجة التي لم يُقرأ نصُّها تبقى بعلامة واضحة بدل فراغ.
 */
export function mergePlanWithOcr(plan: PdfPagePlan, ocrByPage: Map<number, string>): string {
  const parts: string[] = [];
  for (let i = 0; i < plan.pageBodies.length; i += 1) {
    const pageNo = i + 1;
    let body = plan.pageBodies[i];
    if (body === SCANNED_MARK) {
      const ocr = (ocrByPage.get(pageNo) ?? "").trim();
      body = ocr || "[صفحة تعذّرت قراءتها ضوئيًّا]";
    }
    parts.push(`[صفحة ${pageNo}]\n${body}`);
  }
  return parts.join("\n\n").trim();
}

export async function extractLocal(name: string, data: Uint8Array): Promise<ExtractOut> {
  const ext = extOf(name);
  if (TEXT_EXT.has(ext)) {
    return { text: new TextDecoder("utf-8").decode(data), kind: "نص" };
  }
  if (ext === ".docx") {
    // extractDocxText يقبل ArrayBuffer
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const raw = await extractDocxText(ab);
    return { text: raw, kind: "Word" };
  }
  if (ext === ".pdf") {
    // التوجيه على مستوى الصفحة (خلف علم): صفحاتٌ نظيفة تبقى نصًّا رقميًّا، والمعطوبة
    // فقط تُرسَل للمحرّك البعيد — بدل قرارٍ واحدٍ يرسل الكتاب كلّه لأجل صفحةٍ واحدة.
    if (pageLevelEnabled()) {
      const plan = await planPdfPagesNode(data);
      if (plan.needOcrPages.length === 0) {
        const merged = plan.pageBodies.map((b, i) => `[صفحة ${i + 1}]\n${b}`).join("\n\n").trim();
        const processed = processExtractedText(merged, { source: "digital-layer" });
        return { text: processed.body, kind: "PDF (نص)" };
      }
      // كل الصفحات محتاجة → مستند ممسوح كامل؛ لا خطّة (المحرّك البعيد يقرأ الكل)
      if (plan.needOcrPages.length >= plan.total) {
        throw new RemoteNeeded("PDF ممسوح/معطوب — يحتاج محرّك رؤية (Gemini/QARI)");
      }
      // مختلط: احمل الخطّة ليقرأ المُوزّع الصفحات المحتاجة فقط ويدمجها
      throw new RemoteNeeded("PDF مختلط — بعض الصفحات تحتاج مسحًا ضوئيًّا", plan);
    }
    const { text, arabicChars } = await extractPdfTextNode(data);
    if (arabicChars > 30) {
      const processed = processExtractedText(text, { source: "digital-layer" });
      if (!processed.needsOcr) {
        return { text: processed.body, kind: "PDF (نص)" };
      }
    }
    // طبقة نصّ فارغة/معطوبة → يحتاج محرّكاً بعيداً (Gemini/QARI رؤية بالصورة)
    throw new RemoteNeeded("PDF ممسوح/معطوب — يحتاج محرّك رؤية (Gemini/QARI)");
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"].includes(ext)) {
    throw new RemoteNeeded("صورة — تحتاج محرّك رؤية (Gemini/QARI)");
  }
  return { text: "", kind: "صيغة غير مدعومة" };
}
