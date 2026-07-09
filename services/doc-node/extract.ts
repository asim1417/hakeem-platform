// استخراج النص على الخادم (Node) — يعيد استخدام النواة المشتركة نفسها.
//
// نصوص وJSON: فكّ ترميز مباشر. Word: إعادة استخدام extractDocxText (يعمل على Node
// عبر DecompressionStream المدمج). PDF نصّي: pdfjs-dist. الممسوح/الصور: تُفوَّض
// لمحرّكٍ بعيد (Gemini/QARI) عبر السجلّ — فلا OCR ثقيل على معالج الخادم.
//
// كل نصٍّ مُستخرَج يمرّ عبر الدماغ الموحّد processExtractedText — نفس معالجة المتصفح.

import { extractDocxText } from "@/lib/modules/document-inspection/file-extract";
import { processExtractedText } from "@/lib/modules/document-inspection";

export interface ExtractOut {
  text: string;
  kind: string;
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

/**
 * يستخرج نصّ ملفٍ محلياً على الخادم ثم يمرّره عبر الدماغ الموحّد. للـ PDF الممسوح
 * أو الصور (لا طبقة نصّ) يرمي RemoteNeeded ليوجّهه المُوزّع لمحرّكٍ بعيد.
 */
export class RemoteNeeded extends Error {}

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
