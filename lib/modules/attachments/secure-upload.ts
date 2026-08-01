/**
 * تحقق رفع آمن لمرفقات Ask/المنصة — يعيد استخدام mime-sniff القائم.
 */
import { createHash } from "crypto";
import { sniffAllowedMime, sniffMagicBytes } from "@/lib/modules/documents/mime-sniff";
import { isAllowedAttachmentMimeType } from "@/lib/modules/attachments/attachment-metadata";

export const ATTACHMENT_MAX_BYTES = Number(process.env.ATTACHMENT_MAX_BYTES || 25 * 1024 * 1024);
export const ATTACHMENT_MAX_FILES_PER_REQUEST = Number(process.env.ATTACHMENT_MAX_FILES_PER_REQUEST || 10);

export type SecureUploadValidation =
  | {
      ok: true;
      bytes: Uint8Array;
      detectedMimeType: string;
      sha256: string;
      safeFileName: string;
      size: number;
    }
  | { ok: false; code: string; message: string };

/** يمنع Path Traversal ويُبقي امتدادًا آمنًا. */
export function sanitizeAttachmentFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "file";
  return base.replace(/[^\w.\-ء-ي()\s]+/g, "-").slice(0, 180) || "file";
}

export async function validateAttachmentUpload(input: {
  file: File;
  reportedMimeType?: string;
}): Promise<SecureUploadValidation> {
  const size = input.file.size;
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, code: "EMPTY_FILE", message: "الملف فارغ." };
  }
  if (size > ATTACHMENT_MAX_BYTES) {
    return {
      ok: false,
      code: "FILE_TOO_LARGE",
      message: `حجم الملف يتجاوز الحد (${ATTACHMENT_MAX_BYTES.toLocaleString("ar-SA")} بايت).`,
    };
  }

  const safeFileName = sanitizeAttachmentFileName(input.file.name);
  if (/\.(exe|bat|cmd|sh|js|mjs|dll|com|scr|vbs|ps1)$/i.test(safeFileName)) {
    return { ok: false, code: "EXECUTABLE_FORBIDDEN", message: "الملفات التنفيذية غير مسموحة." };
  }

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const magic = sniffMagicBytes(bytes.subarray(0, Math.min(bytes.length, 4100)));
  if (magic === "application/x-msdownload" || magic === "application/x-elf") {
    return { ok: false, code: "EXECUTABLE_FORBIDDEN", message: "عُثر على توقيع ملف تنفيذي." };
  }
  if (magic === "application/zip" && !safeFileName.toLowerCase().endsWith(".docx")) {
    return { ok: false, code: "ARCHIVE_FORBIDDEN", message: "الأرشيفات غير المدعومة مرفوضة." };
  }

  // PDF مشفر بشكل مبسط: /Encrypt في رأس الملف
  if (magic === "application/pdf") {
    const head = Buffer.from(bytes.subarray(0, Math.min(bytes.length, 8192))).toString("latin1");
    if (/\/Encrypt\b/.test(head)) {
      return { ok: false, code: "PDF_ENCRYPTED", message: "ملف PDF مشفر — أرفق نسخة غير محمية." };
    }
    if (!/%PDF/.test(head)) {
      return { ok: false, code: "PDF_CORRUPT", message: "ملف PDF تالف أو غير صالح." };
    }
  }

  const sniffed = await sniffAllowedMime(bytes, input.reportedMimeType || input.file.type);
  if (!sniffed.ok) {
    return {
      ok: false,
      code: sniffed.reasonCode,
      message: "نوع الملف غير مسموح أو لا يطابق المحتوى الحقيقي.",
    };
  }

  // لا نعتمد على file.type وحده — نطابق الاكتشاف
  if (input.file.type && isAllowedAttachmentMimeType(input.file.type)) {
    if (
      input.file.type !== sniffed.detectedMimeType &&
      !(input.file.type === "image/jpg" && sniffed.detectedMimeType === "image/jpeg")
    ) {
      // اختلاف خطير: ادّعاء PDF ومحتوى غير PDF
      if (input.file.type === "application/pdf" && sniffed.detectedMimeType !== "application/pdf") {
        return {
          ok: false,
          code: "MIME_MISMATCH",
          message: "امتداد/MIME المعلن لا يطابق محتوى الملف.",
        };
      }
    }
  }

  const sha256 = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
  return {
    ok: true,
    bytes,
    detectedMimeType: sniffed.detectedMimeType,
    sha256,
    safeFileName,
    size,
  };
}
