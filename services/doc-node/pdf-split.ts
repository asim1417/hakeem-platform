// تقسيم PDF إلى «قطع» (نطاقات صفحات) على الخادم — لتفريغٍ متوازٍ عالي الإنتاجية.
//
// نداءٌ واحد لـ Gemini على 1000 صفحة يُبتَر (حدّ المخرجات). الحلّ: نقسّم الوثيقة إلى
// قطعٍ صغيرة (صفحات قليلة لكلٍّ) ونعالجها متوازيةً بالجدولة المتكيّفة — كأقصى ما يسمح
// به المفتاح. كل قطعة PDF مستقلّة يقرأها Gemini أصلاً (رؤية)، فلا حاجة لرسمٍ ثقيل.

import { PDFDocument } from "pdf-lib";

export interface PdfChunk {
  /** رقم أول صفحة في القطعة (1-based، ضمن الوثيقة الأصلية). */
  firstPage: number;
  /** عدد صفحات القطعة. */
  pageCount: number;
  /** بايتات PDF مستقلّة لهذه القطعة. */
  bytes: Uint8Array;
}

/** عدد صفحات وثيقة PDF (بلا تقسيم) — للتقدير المسبق. */
export async function pdfPageCount(data: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(data, { ignoreEncryption: true });
  return doc.getPageCount();
}

/**
 * يقسّم PDF إلى قطعٍ بحجم pagesPerChunk صفحة. كل قطعة وثيقة PDF مستقلّة صالحة.
 * chunkSize صغير (3–5) يوازن بين عدد النداءات وحدّ مخرجات Gemini لكلّ نداء.
 */
export async function splitPdf(data: Uint8Array, pagesPerChunk = 4): Promise<PdfChunk[]> {
  const size = Math.max(1, pagesPerChunk);
  const src = await PDFDocument.load(data, { ignoreEncryption: true });
  const total = src.getPageCount();
  const chunks: PdfChunk[] = [];

  for (let start = 0; start < total; start += size) {
    const end = Math.min(start + size, total);
    const out = await PDFDocument.create();
    const indices = Array.from({ length: end - start }, (_, k) => start + k);
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
    const bytes = await out.save();
    chunks.push({ firstPage: start + 1, pageCount: end - start, bytes });
  }
  return chunks;
}

export interface PdfSinglePage {
  /** رقم الصفحة (1-based ضمن الوثيقة الأصلية). */
  page: number;
  /** بايتات PDF لصفحةٍ واحدة مستقلّة. */
  bytes: Uint8Array;
}

/**
 * يستخرج صفحاتٍ محدّدة (بأرقامها 1-based) كلَّ واحدةٍ في PDF مستقلّ بصفحةٍ واحدة —
 * ليُقرأ ضوئيًّا فقط ما يحتاج القراءة، ويُدمَج ناتجُه في محلّه برقم الصفحة. تُتجاهَل
 * الأرقام خارج المدى. النتيجة مرتّبةٌ تصاعديًّا بلا تكرار.
 */
export async function extractSinglePages(data: Uint8Array, pageNumbers: number[]): Promise<PdfSinglePage[]> {
  const src = await PDFDocument.load(data, { ignoreEncryption: true });
  const total = src.getPageCount();
  const wanted = Array.from(new Set(pageNumbers)).filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: PdfSinglePage[] = [];
  for (const p of wanted) {
    const one = await PDFDocument.create();
    const [copied] = await one.copyPages(src, [p - 1]);
    one.addPage(copied);
    out.push({ page: p, bytes: await one.save() });
  }
  return out;
}
