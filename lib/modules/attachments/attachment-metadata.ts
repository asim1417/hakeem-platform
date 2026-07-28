export type AttachmentMetadata = {
  size?: number;
  relationType?: string;
  relationId?: string;
  uploadedBy?: string;
  storageMode?: string;
  storageUrl?: string;
  note?: string;
};

export interface LegacyAttachmentPayload {
  extractedText: string | null;
  metadata: Record<string, unknown>;
  actualText: string | null;
  legacyMetadataDetected: boolean;
}

const LEGACY_METADATA_KEYS = ["storageMode", "storageUrl", "uploadedBy", "relationType"] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * قارئ توافق خلفي: السجلات القديمة خزّنت JSON metadata داخل extractedText.
 * السجلات الجديدة تضع metadata في العمود الصريح وتترك extractedText للنص الفعلي (أو null).
 */
export function decodeLegacyAttachmentPayload(
  extractedText: string | null,
  metadata: unknown
): LegacyAttachmentPayload {
  const explicitMetadata = asRecord(metadata);
  if (!extractedText) {
    return {
      extractedText: null,
      metadata: explicitMetadata,
      actualText: null,
      legacyMetadataDetected: false
    };
  }
  try {
    const parsed = JSON.parse(extractedText);
    if (
      parsed &&
      typeof parsed === "object" &&
      LEGACY_METADATA_KEYS.some((key) => key in parsed)
    ) {
      return {
        extractedText,
        metadata: {
          ...asRecord(parsed),
          ...explicitMetadata
        },
        actualText: null,
        legacyMetadataDetected: true
      };
    }
  } catch {
    // نص عادي، وليس JSON.
  }
  return {
    extractedText,
    metadata: explicitMetadata,
    actualText: extractedText,
    legacyMetadataDetected: false
  };
}

/** يحوّل سجل metadata مدمج إلى شكل DTO المعروف للواجهة. */
export function metadataToDtoFields(metadata: Record<string, unknown>): AttachmentMetadata {
  const out: AttachmentMetadata = {};
  if (typeof metadata.size === "number") out.size = metadata.size;
  if (typeof metadata.relationType === "string") out.relationType = metadata.relationType;
  if (typeof metadata.relationId === "string") out.relationId = metadata.relationId;
  if (typeof metadata.uploadedBy === "string") out.uploadedBy = metadata.uploadedBy;
  if (typeof metadata.storageMode === "string") out.storageMode = metadata.storageMode;
  if (typeof metadata.storageUrl === "string") out.storageUrl = metadata.storageUrl;
  if (typeof metadata.note === "string") out.note = metadata.note;
  return out;
}

/**
 * توافق خلفي: يقرأ JSON من extractedText فقط (السلوك السابق).
 * للمسارات الجديدة فضّل resolveAttachmentMetadata.
 */
export function parseAttachmentMetadata(value: string | null): AttachmentMetadata {
  const decoded = decodeLegacyAttachmentPayload(value, {});
  if (decoded.legacyMetadataDetected) {
    return metadataToDtoFields(decoded.metadata);
  }
  if (!value) return {};
  try {
    return JSON.parse(value) as AttachmentMetadata;
  } catch {
    return { note: value };
  }
}

/** دمج عمود metadata الصريح مع التوافق الخلفي لـ extractedText. */
export function resolveAttachmentMetadata(
  extractedText: string | null,
  metadata: unknown
): AttachmentMetadata {
  const decoded = decodeLegacyAttachmentPayload(extractedText, metadata);
  return metadataToDtoFields(decoded.metadata);
}

/** رابط التخزين المخزَّن (SharePoint webUrl وغيرها) مع دعم السجلات القديمة. */
export function resolveStoredAttachmentUrl(
  extractedText: string | null,
  metadata: unknown
): string | null {
  const fields = resolveAttachmentMetadata(extractedText, metadata);
  return typeof fields.storageUrl === "string" && fields.storageUrl ? fields.storageUrl : null;
}

export function formatFileSize(size?: number) {
  if (!size) return "غير محدد";
  if (size < 1024) return `${size.toLocaleString("ar-SA")} بايت`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString("ar-SA")} ك.ب`;
  return `${(size / 1024 / 1024).toFixed(1)} م.ب`;
}

/** MIME المسموح لرفع المرفقات — مصدر حقيقة واحد للـ API والاختبارات. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg"
]);

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_MIME_TYPES.has(mimeType);
}

export type AttachmentDtoInput = {
  id: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  extractedText: string | null;
  metadata?: unknown;
  processingStatus?: string;
  createdAt: Date | string;
  caseFile?: { id: string; title: string } | null;
};

/** شكل DTO الحالي للواجهة — يبقى متوافقًا مع AttachmentsManager. */
export function toAttachmentDto(attachment: AttachmentDtoInput) {
  const meta = resolveAttachmentMetadata(attachment.extractedText, attachment.metadata);
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    storageKey: attachment.storageKey,
    createdAt: attachment.createdAt,
    caseFile: attachment.caseFile,
    processingStatus: attachment.processingStatus,
    ...meta
  };
}
