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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const xmlBytes = await extractZipEntry(buffer, "word/document.xml");
  if (!xmlBytes) throw new Error("ملف DOCX بلا محتوى نصي");
  return docxXmlToText(new TextDecoder("utf-8").decode(xmlBytes));
}

// ── PDF (رقمي): يعمل في المتصفح فقط (pdfjs worker) ──

export interface PdfExtractResult {
  text: string;
  pages: number;
  /** صفحات بلا نص يُذكر — مؤشر مسح ضوئي يحتاج OCR */
  emptyPages: number;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  const parts: string[] = [];
  let emptyPages = 0;
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText.length < 10) emptyPages += 1;
    parts.push(`[صفحة ${p}]\n${pageText}`);
  }
  await doc.destroy();
  return { text: parts.join("\n\n").trim(), pages: doc.numPages, emptyPages };
}

// ── الموزّع حسب النوع ──

export interface ExtractedFile {
  title: string;
  rawText: string;
  warning?: string;
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
    if (result.text.replace(/\[صفحة \d+\]/g, "").trim().length < 20) {
      throw new Error("هذا PDF ممسوح ضوئياً (صور بلا نص) — يحتاج معالجة OCR خارجية قبل رفعه");
    }
    const warning =
      result.emptyPages > 0 ? `${result.emptyPages} من ${result.pages} صفحة بلا نص (ممسوحة ضوئياً؟) — راجعها` : undefined;
    return { title: name, rawText: result.text, warning };
  }
  throw new Error("صيغة غير مدعومة — يُقبل: PDF نصّي، DOCX، TXT، JSON");
}
