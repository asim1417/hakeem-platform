// استخراج نص الملفات داخل المتصفح — لا يغادر الملف جهاز المستخدم.
// نص مباشر + Word (docx: فك zip أصلي عبر DecompressionStream ثم قراءة document.xml).
// ملفات PDF الممسوحة والصور تحتاج OCR — متوفر في نسخة الخادم (tools/arabic-doc-tool).

export interface ExtractResult {
  text: string;
  /** وصف طريقة الاستخراج بالعربية — يُعرض للمستخدم */
  kind: string;
}

const TEXT_EXTS = ["txt", "md", "csv", "json"];

function xmlUnescape(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** يقرأ word/document.xml من ملف docx (بنية zip) ويعيد نصه */
async function docxText(buf: ArrayBuffer): Promise<string> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  const td = new TextDecoder();

  // سجل نهاية الفهرس المركزي (EOCD)
  let eocd = -1;
  const lo = Math.max(0, u8.length - 22 - 65536);
  for (let i = u8.length - 22; i >= lo; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ليس ملف docx سليماً");

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  let target: { method: number; csize: number; lho: number } | null = null;
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = td.decode(u8.subarray(p + 46, p + 46 + nlen));
    if (name === "word/document.xml") target = { method, csize, lho };
    p += 46 + nlen + elen + clen;
  }
  if (!target) throw new Error("لا يحتوي word/document.xml");

  const q = target.lho;
  const lnl = dv.getUint16(q + 26, true);
  const lel = dv.getUint16(q + 28, true);
  const comp = u8.subarray(q + 30 + lnl + lel, q + 30 + lnl + lel + target.csize);

  let xmlBytes: Uint8Array;
  if (target.method === 0) {
    xmlBytes = comp;
  } else {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([comp as BlobPart]).stream().pipeThrough(ds);
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }

  const xml = td.decode(xmlBytes);
  const out: string[] = [];
  for (const para of xml.split(/<\/w:p>/)) {
    const seg = para.replace(/<w:br[^>]*\/>/g, "\n").replace(/<w:tab[^>]*\/>/g, "\t");
    let t = "";
    const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg))) t += xmlUnescape(m[1]);
    out.push(t);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** يستخرج نص ملف بحسب صيغته — يعمل في المتصفح فقط */
export async function extractFile(file: File): Promise<ExtractResult> {
  const ext = (file.name.match(/\.([^.]+)$/)?.[1] ?? "").toLowerCase();
  if (TEXT_EXTS.includes(ext)) {
    return { text: new TextDecoder("utf-8").decode(await file.arrayBuffer()), kind: "نص" };
  }
  if (ext === "docx") {
    try {
      return { text: await docxText(await file.arrayBuffer()), kind: "Word" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { text: "", kind: `تعذّر (${msg.slice(0, 40)})` };
    }
  }
  if (ext === "pdf" || ["png", "jpg", "jpeg", "tif", "tiff", "bmp"].includes(ext)) {
    return { text: "", kind: "يحتاج نسخة الخادم (OCR)" };
  }
  return { text: "", kind: "صيغة غير مدعومة" };
}
