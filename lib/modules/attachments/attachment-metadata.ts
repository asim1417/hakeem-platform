export type AttachmentMetadata = {
  size?: number;
  relationType?: string;
  relationId?: string;
  uploadedBy?: string;
  storageMode?: string;
  note?: string;
};

export function parseAttachmentMetadata(value: string | null): AttachmentMetadata {
  if (!value) return {};
  try {
    return JSON.parse(value) as AttachmentMetadata;
  } catch {
    return { note: value };
  }
}

export function formatFileSize(size?: number) {
  if (!size) return "غير محدد";
  if (size < 1024) return `${size.toLocaleString("ar-SA")} بايت`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString("ar-SA")} ك.ب`;
  return `${(size / 1024 / 1024).toFixed(1)} م.ب`;
}
