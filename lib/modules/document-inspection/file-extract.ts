// استخراج النص من الملفات المرفوعة — كله محلياً (متصفح المستخدم)، لا يُرسل الملف لأي خادم.
// يدعم: TXT · DOCX (فك ZIP يدوي + XML) · PDF رقمي (pdfjs، في المكوّن لأن worker متصفح فقط).
// الممسوح ضوئياً (صور) يحتاج OCR خارجياً — نكشفه ونخبر المستخدم بوضوح.

// ── DOCX: قارئ ZIP مصغّر (central directory) + فك deflate عبر DecompressionStream ──

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

interface ZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  localOffset: number;
}

function findEocd(view: DataView): number {
  const min = Math.max(0, view.byteLength - 65557);
  for (let i = view.byteLength - 22; i >= min; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  return -1;
}

function readEntries(buffer: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buffer);
  const eocd = findEocd(view);
  if (eocd < 0) throw new Error("ليس ملف ZIP صالحاً");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder("utf-8");
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIG) break;
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = dec.decode(new Uint8Array(buffer, offset + 46, nameLen));
    entries.push({ name, compression, compressedSize, localOffset });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // نسخة نظيفة: بعض المتصفحات تتعامل مع Blob على منظر Uint8Array (byteOffset) بشكل خاطئ
  const clean = data.slice();
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([clean.buffer as ArrayBuffer]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** يستخرج ملفاً واحداً من أرشيف ZIP (يكفي لـ DOCX) */
export async function extractZipEntry(buffer: ArrayBuffer, entryName: string): Promise<Uint8Array | null> {
  const entry = readEntries(buffer).find((e) => e.name === entryName);
  if (!entry) return null;
  const view = new DataView(buffer);
  const lo = entry.localOffset;
  if (view.getUint32(lo, true) !== LOCAL_SIG) throw new Error("ترويسة ZIP تالفة");
  const nameLen = view.getUint16(lo + 26, true);
  const extraLen = view.getUint16(lo + 28, true);
  const dataStart = lo + 30 + nameLen + extraLen;
  const raw = new Uint8Array(buffer.slice(dataStart, dataStart + entry.compressedSize));
  if (entry.compression === 0) return raw; // stored
  if (entry.compression === 8) return inflateRaw(raw); // deflate
  throw new Error("ضغط ZIP غير مدعوم");
}

/** يحوّل document.xml (وورد) إلى نص عادي بفواصل فقرات */
export function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    // بنية الجداول: خليّة ← فاصلة جدولة، صفّ ← سطر جديد (كثير من الوثائق القانونية جداول)
    .replace(/<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/w:p>/g, "\n");
  const texts: string[] = [];
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|(\n|\t)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withBreaks)) !== null) {
    if (m[1] !== undefined) {
      texts.push(
        m[1]
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
      );
    } else texts.push(m[2]);
  }
  return texts
    .join("")
    // تنظيف حدود الجداول: سطر الفقرة داخل الخليّة قبل فاصلة الجدولة يُطوى،
    // وفاصلة الخليّة الزائدة قبل نهاية الصفّ تُحذف
    .replace(/\n+\t/g, "\t")
    .replace(/\t+\n/g, "\n")
    .replace(/\t{2,}/g, "\t")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const xmlBytes = await extractZipEntry(buffer, "word/document.xml");
  if (!xmlBytes) throw new Error("ملف DOCX بلا محتوى نصي");
  return docxXmlToText(new TextDecoder("utf-8").decode(xmlBytes));
}

// ── PDF (رقمي): يعمل في المتصفح فقط (pdfjs worker) ──

import { cleanPdfTextLayer } from "./reshape";

/** علامةُ صفحةٍ بلا طبقة نصّ (صورة ممسوحة) — تُوضَع مكان الفراغ فلا تختفي الصفحة صامتةً */
export const SCANNED_PAGE_MARK = "(صفحة بلا طبقة نصّ — صورة ممسوحة تحتاج قراءة ضوئية OCR)";

export interface PdfExtractResult {
  text: string;
  pages: number;
  /** عدد الصفحات بلا نص يُذكر — مؤشر مسح ضوئي يحتاج OCR */
  emptyPages: number;
  /** أرقام تلك الصفحات (1-based) — لقراءتها ضوئياً ودمجها لاحقاً */
  emptyPageNumbers: number[];
  /** طبقة النصّ معطوبة بدرجة يتعذّر إصلاحها نصّياً (خطّ مُجزّأ) — المصدر الصحيح OCR */
  needsOcr: boolean;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  const emptyPageNumbers: number[] = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText.length < 10) {
      // صفحة بلا طبقة نصّ (صورة ممسوحة): علِّمها بوضوح بدل تركها فراغاً صامتاً.
      emptyPageNumbers.push(p);
      parts.push(`[صفحة ${p}]\n${SCANNED_PAGE_MARK}`);
    } else {
      parts.push(`[صفحة ${p}]\n${pageText}`);
    }
  }
  await doc.destroy();
  // إصلاح طبقة النصّ العربية المعطوبة (صيغ عرض معزولة/مُضاعَفة) قبل تسليمها.
  const cleaned = cleanPdfTextLayer(parts.join("\n\n").trim());
  return {
    text: cleaned.text,
    pages: doc.numPages,
    emptyPages: emptyPageNumbers.length,
    emptyPageNumbers,
    needsOcr: cleaned.needsOcr
  };
}

/**
 * يدمج نصَّ الصفحات المقروءة ضوئياً في نصّ طبقة النصّ الأصلي، محلَّ علامة الصفحة
 * الممسوحة. يُبقي الصفحات ذات النصّ السليم كما هي.
 */
export function mergeScannedPages(base: string, ocrText: string): string {
  const blocks = new Map<number, string>();
  const re = /\[صفحة (\d+)\]\n([\s\S]*?)(?=\n\n\[صفحة |$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(ocrText))) {
    const body = m[2].trim();
    if (body) blocks.set(Number(m[1]), body);
  }
  // نستبدل متن كل صفحةٍ لدينا قراءتها الضوئية (مطابقةٌ بالبنية، لا بنصّ العلامة —
  // فقد يكون التنظيف غيّر شكل العلامة). الصفحات ذات النصّ السليم لا تُمسّ لأنها
  // ليست ضمن blocks (لم تُقرأ ضوئياً).
  return base.replace(/\[صفحة (\d+)\]\n([\s\S]*?)(?=\n\n\[صفحة |$)/g, (whole, num: string) => {
    const body = blocks.get(Number(num));
    return body ? `[صفحة ${num}]\n${body}` : whole;
  });
}

/**
 * تحليلٌ لكل صفحة: أيّها طبقةُ نصٍّ سليمة (نستعملها كما هي) وأيّها ممسوحة/معطوبة
 * (تحتاج قراءةً ضوئية سحابية). يُعيد نصّاً أساسياً بعلامات الصفحات، وقائمةَ الصفحات
 * التي تحتاج OCR — فنقرأ سحابياً ما يحتاجه فقط، ولا نرمي النصّ الرقميّ السليم.
 */
export interface PdfPageOcrPlan {
  total: number;
  /** أرقام الصفحات (ضمن النطاق) التي تحتاج قراءةً ضوئية (فارغة أو معطوبة) */
  needOcrPages: number[];
  /** عدد الصفحات ذات النصّ الرقميّ السليم ضمن النطاق */
  cleanPages: number;
  /** النصّ الأساسي بعلامات [صفحة N]: الصفحات السليمة بنصّها، والباقي بعلامة الممسوح */
  baseText: string;
}

export async function planPdfPageOcr(buffer: ArrayBuffer, from?: number, to?: number): Promise<PdfPageOcrPlan> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const total = doc.numPages;
  const start = Math.max(1, Math.min(from ?? 1, total));
  const end = Math.max(start, Math.min(to ?? total, total));

  const parts: string[] = [];
  const needOcrPages: number[] = [];
  let cleanPages = 0;
  for (let p = start; p <= end; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const raw = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (raw.length < 10) {
      // صفحة بلا طبقة نصّ (ممسوحة) → للقراءة الضوئية
      needOcrPages.push(p);
      parts.push(`[صفحة ${p}]\n${SCANNED_PAGE_MARK}`);
      continue;
    }
    const cleaned = cleanPdfTextLayer(raw);
    if (cleaned.needsOcr) {
      // طبقة نصٍّ معطوبة (خطّ مُجزّأ/ترتيب بصري) → أصدق مصدرٍ لها OCR على صورة الصفحة
      needOcrPages.push(p);
      parts.push(`[صفحة ${p}]\n${SCANNED_PAGE_MARK}`);
    } else {
      cleanPages += 1;
      parts.push(`[صفحة ${p}]\n${cleaned.text}`);
    }
  }
  await doc.destroy();
  return { total, needOcrPages, cleanPages, baseText: parts.join("\n\n").trim() };
}

// ── الموزّع حسب النوع ──

export interface ExtractedFile {
  title: string;
  rawText: string;
  warning?: string;
  /** أرقام صفحات PDF بلا طبقة نصّ (صور ممسوحة) — يمكن قراءتها ضوئياً ودمجها */
  scannedPages?: number[];
}

export async function extractFromFile(file: File): Promise<ExtractedFile> {
  const name = file.name.replace(/\.[^.]+$/, "");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (ext === "txt" || ext === "md") {
    return { title: name, rawText: await file.text() };
  }
  if (ext === "docx") {
    const rawText = await extractDocxText(await file.arrayBuffer());
    if (rawText.trim().length < 5) throw new Error("لم يُعثر على نص في ملف الوورد");
    return { title: name, rawText };
  }
  if (ext === "pdf") {
    const result = await extractPdfText(await file.arrayBuffer());
    // كل الصفحات بلا طبقة نصّ → مستند ممسوح بالكامل، وجّهه إلى OCR.
    if (result.emptyPages >= result.pages) {
      throw new Error("هذا PDF ممسوح ضوئياً (صور بلا نص) — يحتاج معالجة OCR خارجية قبل رفعه");
    }
    // طبقة نصّ معطوبة يتعذّر إصلاحها نصّياً (خطّ مُجزّأ بلا يونيكود) → وجّه إلى OCR على صورة الصفحة
    if (result.needsOcr) {
      throw new Error(
        "طبقة نصّ هذا الـ PDF معطوبة (خطّ مُجزّأ يخرج رموزاً غير صحيحة) — يُنصح بتشغيل القراءة الضوئية OCR للحصول على نصّ سليم"
      );
    }
    // مسحٌ جزئي: بعض الصفحات نصّ سليم وبعضها صور. نُعيدها كلها مع أرقام الصفحات الممسوحة
    // ليعرض المستدعي قراءتها ضوئياً ودمجها (بدل فراغ صامت).
    const warning =
      result.emptyPages > 0
        ? `الصفحات (${result.emptyPageNumbers.join("، ")}) صور ممسوحة بلا نص — تحتاج قراءة ضوئية OCR`
        : undefined;
    return {
      title: name,
      rawText: result.text,
      warning,
      scannedPages: result.emptyPageNumbers.length ? result.emptyPageNumbers : undefined
    };
  }
  throw new Error("صيغة غير مدعومة — يُقبل: PDF نصّي، DOCX، TXT، JSON");
}
