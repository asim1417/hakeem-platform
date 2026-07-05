// القراءة السحابية (Gemini) من جهة العميل — مشتركة بين البحث السريع ومحطة العمل.
//
// درس مستفاد من وثائق فعلية: إرسال ملف PDF كاملاً إلى Gemini يجعله يقرأ «طبقة النص»
// المدفونة فيه إن وُجدت — وطبقات InDesign العربية كثيراً ما تكون بترتيب العرض البصري
// (كلمات مبعثرة الأجزاء: الزتامات/الرشكة/عــ ىل) فيرث السحابي عطبها. الحل الجذري هنا:
// نحوّل كل صفحة إلى صورة في المتصفح ثم نرسل الصور — فيُجبر Gemini على الرؤية الحقيقية.
//
// كلها تعيد null عند أي فشل ليسقط المستدعي للمعالجة المحلية بأمان.

export type CloudProgress = (label: string) => void;

/** حد جسم الطلب الواحد (Vercel ~4.5MB وbase64 يضخّم) */
const MAX_UPLOAD_BYTES = 3_400_000;
/** دقة تحويل الصفحة لصورة — 2 كافية لرؤية Gemini (المحلي يستخدم 3 لأن Tesseract يتطلب دقة أعلى) */
const PAGE_SCALE = 2;
/** جودة JPEG — توازن حجم/وضوح */
const JPEG_QUALITY = 0.87;

async function postToCloud(blob: Blob, name: string): Promise<string | null> {
  try {
    if (blob.size > MAX_UPLOAD_BYTES) return null;
    const fd = new FormData();
    fd.append("file", new File([blob], name, { type: blob.type || "application/octet-stream" }));
    const res = await fetch("/api/doc-tool/ocr", { method: "POST", body: fd });
    const json = (await res.json()) as { text?: string };
    if (!res.ok || !json.text || json.text.trim().length < 3) return null;
    return json.text.trim();
  } catch {
    return null;
  }
}

/** قراءة صورة (ملف مرفوع) سحابياً */
export async function cloudOcrImage(file: File, onProgress?: CloudProgress): Promise<string | null> {
  onProgress?.("قراءة سحابية فائقة الدقة (Gemini)…");
  return postToCloud(file, file.name);
}

/**
 * قراءة PDF سحابياً — صفحةً صفحة كصور مرسومة في المتصفح (رؤية حقيقية، لا طبقة نص).
 * يعيد النص موحّداً بعلامات [صفحة N]، أو null إن لم تُقرأ أي صفحة.
 */
export async function cloudOcrPdfPages(
  buffer: ArrayBuffer,
  onProgress?: CloudProgress
): Promise<string | null> {
  try {
    onProgress?.("تجهيز صفحات الـ PDF للقراءة السحابية…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const doc = await pdfjs.getDocument({ data: buffer }).promise;
    const parts: string[] = [];
    let okPages = 0;
    for (let p = 1; p <= doc.numPages; p += 1) {
      onProgress?.(`قراءة سحابية (Gemini) — صفحة ${p}/${doc.numPages}…`);
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: PAGE_SCALE });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/jpeg", JPEG_QUALITY)
      );
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) continue;
      const text = await postToCloud(blob, `page-${p}.jpg`);
      if (text) {
        okPages += 1;
        parts.push(`[صفحة ${p}]\n${text}`);
      } else {
        parts.push(`[صفحة ${p}]\n(تعذّرت قراءة هذه الصفحة سحابياً)`);
      }
    }
    await doc.destroy();
    // فشل شامل (مفتاح/شبكة) → أسقط للمحلي؛ نجاح جزئي مقبول ويُعلَّم موضع النقص
    if (okPages === 0) return null;
    return parts.join("\n\n").trim();
  } catch {
    return null;
  }
}
