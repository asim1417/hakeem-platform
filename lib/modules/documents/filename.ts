/** تنظيف واستخراج اسم الملف من Content-Disposition أو مسار URL. */

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function sanitizeFileName(raw: string, fallback = "document"): string {
  let name = raw.normalize("NFKC");
  name = name.replace(CONTROL_CHARS, "");
  name = name.replace(/\\/g, "/");
  // path traversal
  name = name.split("/").filter((p) => p && p !== "." && p !== "..").pop() ?? fallback;
  name = name.replace(/[^\w.\-ء-ي\u0600-\u06FF ()[\]]+/g, "-").trim();
  if (!name || name === "." || name === "..") name = fallback;
  if (name.length > 180) {
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    name = name.slice(0, 180 - ext.length) + ext;
  }
  return name;
}

export function fileNameFromContentDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  // filename*=UTF-8''...
  const star = /filename\*\s*=\s*(?:UTF-8''|utf-8'')([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return sanitizeFileName(decodeURIComponent(star[1].trim().replace(/^"|"$/g, "")));
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*("?)([^";]+)\1/i.exec(header);
  if (plain?.[2]) return sanitizeFileName(plain[2].trim());
  return undefined;
}

export function fileNameFromUrlPath(url: string): string | undefined {
  try {
    const path = new URL(url).pathname;
    const last = path.split("/").filter(Boolean).pop();
    if (!last) return undefined;
    return sanitizeFileName(decodeURIComponent(last));
  } catch {
    return undefined;
  }
}

export function fileNameForMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "document.pdf";
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return "document.docx";
    case "text/plain":
      return "document.txt";
    case "image/png":
      return "image.png";
    case "image/jpeg":
      return "image.jpg";
    default:
      return "document.bin";
  }
}

export function resolveDownloadFileName(opts: {
  contentDisposition: string | null;
  url: string;
  mimeType: string;
}): string {
  return (
    fileNameFromContentDisposition(opts.contentDisposition) ||
    fileNameFromUrlPath(opts.url) ||
    fileNameForMime(opts.mimeType)
  );
}
