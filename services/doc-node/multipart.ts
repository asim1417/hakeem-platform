// محلّل multipart/form-data مصغّر وآمن على البيانات الثنائية — بلا تبعيات.
// يكفي رفع الملفات (files) والحقول النصّية (provider/model) من الواجهة.

export interface ParsedPart {
  name: string;
  filename?: string;
  data: Buffer;
}

export function parseMultipart(body: Buffer, contentType: string): ParsedPart[] {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!m) return [];
  const boundary = "--" + (m[1] ?? m[2]).trim();
  const parts: ParsedPart[] = [];
  const delim = Buffer.from(boundary);
  const CRLFCRLF = Buffer.from("\r\n\r\n");

  let start = body.indexOf(delim);
  if (start < 0) return [];
  start += delim.length;
  for (;;) {
    // نهاية الجسم: "--" بعد الحدّ
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
    // تخطّي CRLF بعد الحدّ
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
    const next = body.indexOf(delim, start);
    if (next < 0) break;
    // جزءٌ = [start, next-2) (قبل CRLF الذي يسبق الحدّ)
    const headerEnd = body.indexOf(CRLFCRLF, start);
    if (headerEnd < 0 || headerEnd > next) break;
    const headers = body.subarray(start, headerEnd).toString("utf-8");
    const dataStart = headerEnd + CRLFCRLF.length;
    const dataEnd = next - 2; // اقتطع CRLF الأخير
    const data = body.subarray(dataStart, Math.max(dataStart, dataEnd));
    const nameM = /name="([^"]*)"/i.exec(headers);
    const fileM = /filename="([^"]*)"/i.exec(headers);
    if (nameM) {
      parts.push({ name: nameM[1], filename: fileM ? fileM[1] : undefined, data: Buffer.from(data) });
    }
    start = next + delim.length;
  }
  return parts;
}
