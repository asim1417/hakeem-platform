import { ALLOWED_ATTACHMENT_MIME_TYPES } from "@/lib/modules/attachments/attachment-metadata";

export type MimeSniffResult =
  | { ok: true; detectedMimeType: string }
  | { ok: false; reasonCode: "REMOTE_CONTENT_NOT_A_FILE" | "MIME_NOT_ALLOWED" | "MIME_MISMATCH_HTML" };

function looksLikeHtml(head: Uint8Array): boolean {
  const asText = Buffer.from(head).toString("utf8", 0, Math.min(head.length, 512)).trim().toLowerCase();
  return (
    asText.startsWith("<!doctype html") ||
    asText.startsWith("<html") ||
    asText.includes("<head>") ||
    asText.startsWith("<?xml")
  );
}

/** كشف سريع بالـ magic bytes للصيغ المسموحة — يعمل بلا اعتماد ESM. */
export function sniffMagicBytes(head: Uint8Array): string | null {
  if (head.length === 0) return null;
  // PE/MZ executable
  if (head.length >= 2 && head[0] === 0x4d && head[1] === 0x5a) {
    return "application/x-msdownload";
  }
  // ELF
  if (head.length >= 4 && head[0] === 0x7f && head[1] === 0x45 && head[2] === 0x4c && head[3] === 0x46) {
    return "application/x-elf";
  }
  if (head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    return "application/pdf"; // %PDF
  }
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return "image/png";
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // DOCX = ZIP (PK) — نتحقق من وجود word/ ؛ ZIP عام مرفوض
  if (head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)) {
    const asLatin = Buffer.from(head).toString("latin1");
    if (asLatin.includes("word/") || asLatin.includes("[Content_Types].xml")) {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    return "application/zip";
  }
  return null;
}

function isPrintableText(sample: Uint8Array): boolean {
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    // اسمح بـ UTF-8 (أي بايت ≥ 0x80) والمسافات/الأسطر والطباعة ASCII
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b !== 127)) continue;
    control += 1;
  }
  return control / sample.length < 0.05;
}

/**
 * يشمّ البايتات الأولى. لا يعتمد على Content-Type أو الامتداد.
 * HTML المتنكّر يُرفض صراحةً.
 */
export async function sniffAllowedMime(buffer: Uint8Array, reportedMimeType?: string): Promise<MimeSniffResult> {
  if (!buffer.length) {
    return { ok: false, reasonCode: "MIME_NOT_ALLOWED" };
  }
  const head = buffer.subarray(0, Math.min(buffer.length, 4100));
  if (looksLikeHtml(head)) {
    return { ok: false, reasonCode: "REMOTE_CONTENT_NOT_A_FILE" };
  }

  let mime = sniffMagicBytes(head);

  // تعزيز اختياري عبر file-type (ESM) إن أمكن تحميله
  if (!mime) {
    try {
      const mod = await import("file-type");
      const detected = await mod.fileTypeFromBuffer(head);
      if (detected) {
        const raw = detected.mime as string;
        mime = raw === "image/jpg" ? "image/jpeg" : raw;
      }
    } catch {
      /* file-type غير متاح في هذا السياق — نعتمد magic bytes */
    }
  }

  if (mime) {
    if (mime === "text/html" || mime === "application/xhtml+xml") {
      return { ok: false, reasonCode: "REMOTE_CONTENT_NOT_A_FILE" };
    }
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(mime)) {
      return { ok: false, reasonCode: "MIME_NOT_ALLOWED" };
    }
    if (reportedMimeType?.toLowerCase().includes("pdf") && mime !== "application/pdf") {
      if (mime.startsWith("text/") || mime.includes("html")) {
        return { ok: false, reasonCode: "MIME_MISMATCH_HTML" };
      }
    }
    return { ok: true, detectedMimeType: mime };
  }

  if (isPrintableText(head)) {
    return { ok: true, detectedMimeType: "text/plain" };
  }

  return { ok: false, reasonCode: "MIME_NOT_ALLOWED" };
}
