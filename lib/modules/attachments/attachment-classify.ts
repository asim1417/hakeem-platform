/**
 * تصنيف معرفات المرفقات قبل hasDoc — قوائم منفصلة للأخطاء.
 */
export type AttachmentIdBuckets = {
  missingIds: string[];
  forbiddenIds: string[];
  pendingIds: string[];
  failedIds: string[];
  quarantinedIds: string[];
  partialIds: string[];
  readyIds: string[];
};

const PENDING = new Set([
  "UPLOADED",
  "QUEUED",
  "DOWNLOADING",
  "SECURITY_SCAN",
  "EXTRACTING",
  "OCR",
  "QUALITY_CHECK",
]);

export type OwnedAttachmentRow = {
  id: string;
  processingStatus: string;
  owned: boolean;
  hasText: boolean;
};

export function classifyAttachmentIds(
  requestedIds: string[],
  rows: OwnedAttachmentRow[]
): AttachmentIdBuckets {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const buckets: AttachmentIdBuckets = {
    missingIds: [],
    forbiddenIds: [],
    pendingIds: [],
    failedIds: [],
    quarantinedIds: [],
    partialIds: [],
    readyIds: [],
  };

  for (const id of requestedIds) {
    const row = byId.get(id);
    if (!row) {
      buckets.missingIds.push(id);
      continue;
    }
    if (!row.owned) {
      buckets.forbiddenIds.push(id);
      continue;
    }
    const st = row.processingStatus;
    if (st === "QUARANTINED") buckets.quarantinedIds.push(id);
    else if (st === "FAILED") buckets.failedIds.push(id);
    else if (st === "PARTIAL") buckets.partialIds.push(id);
    else if (st === "READY") buckets.readyIds.push(id);
    else if (PENDING.has(st)) buckets.pendingIds.push(id);
    else if (row.hasText) buckets.readyIds.push(id);
    else buckets.pendingIds.push(id);
  }
  return buckets;
}

export function hasAttachmentReference(b: AttachmentIdBuckets): boolean {
  return (
    b.readyIds.length +
      b.partialIds.length +
      b.pendingIds.length +
      b.failedIds.length +
      b.quarantinedIds.length >
    0
  );
}

export function hasReadyAttachmentContent(b: AttachmentIdBuckets): boolean {
  return b.readyIds.length + b.partialIds.length > 0;
}

/**
 * ترتيب أخطاء attached-only وفق الأمر التنفيذي.
 * يعيد null إن أمكن المتابعة (ready/partial أو لا حاجة لرفض).
 */
export function resolveAttachedOnlyError(
  b: AttachmentIdBuckets,
  opts: { hasLegacyDocument: boolean }
): { code: string; message: string; status: number; attachmentIds: string[] } | null {
  if (b.forbiddenIds.length || b.missingIds.length) {
    return {
      code: "ATTACHMENT_FORBIDDEN",
      message: "مرفق غير مملوك أو غير موجود.",
      status: 403,
      attachmentIds: [...b.forbiddenIds, ...b.missingIds],
    };
  }
  if (!hasAttachmentReference(b) && !opts.hasLegacyDocument) {
    return {
      code: "SOURCE_POLICY_REQUIRES_ATTACHMENT",
      message: "نطاق المصادر «المرفقات فقط» يتطلّب إرفاق مستند قبل الإرسال.",
      status: 400,
      attachmentIds: [],
    };
  }
  if (b.quarantinedIds.length && !hasReadyAttachmentContent(b)) {
    return {
      code: "ATTACHMENT_QUARANTINED",
      message: "المرفق في الحجر الصحي ولا يمكن استخدامه.",
      status: 403,
      attachmentIds: b.quarantinedIds,
    };
  }
  if (b.failedIds.length && !hasReadyAttachmentContent(b) && !b.pendingIds.length) {
    return {
      code: "ATTACHMENT_PROCESSING_FAILED",
      message: "فشلت معالجة المرفق.",
      status: 422,
      attachmentIds: b.failedIds,
    };
  }
  if (b.pendingIds.length && !hasReadyAttachmentContent(b)) {
    return {
      code: "ATTACHMENT_NOT_READY",
      message: "المرفق لم يكتمل معالجته بعد.",
      status: 409,
      attachmentIds: b.pendingIds,
    };
  }
  return null;
}
