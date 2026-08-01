/**
 * توحيد أعلام مرفقات Composer — قرار موحد للعميل/الخادم.
 *
 * V2 (ATTACHMENTS_V2) هو المسار الحالي.
 * DOCUMENTS_V1 توافق خلفي فقط — ليس شرطًا لتشغيل V2.
 */
function envOn(name: string): boolean {
  const v = (process.env[name] ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function isComposerDocumentsV1Enabled(): boolean {
  return envOn("HAKEEM_COMPOSER_DOCUMENTS_V1");
}

export function isAttachmentsV2ServerEnabled(): boolean {
  return envOn("HAKEEM_COMPOSER_ATTACHMENTS_V2");
}

export function isDocumentProcessingV2Enabled(): boolean {
  return envOn("HAKEEM_DOCUMENT_PROCESSING_V2");
}

export function isDocNodeCallbackEnabled(): boolean {
  return envOn("HAKEEM_DOC_NODE_CALLBACK_V1");
}

/** عميل V1 legacy فقط */
export function isDocumentsV1ClientEnabled(): boolean {
  return envOn("NEXT_PUBLIC_HAKEEM_COMPOSER_DOCUMENTS_V1");
}

/** عميل V2 — رفع attachmentIds */
export function isAttachmentsV2ClientEnabled(): boolean {
  return envOn("NEXT_PUBLIC_HAKEEM_COMPOSER_ATTACHMENTS_V2");
}

/**
 * قرار موحد: هل يحاول العميل الإصرار على /api/attachments؟
 * V2 له الأولوية؛ V1 للتوافق فقط.
 * لا يشترط DOCUMENTS_V1 لتشغيل V2.
 */
export function isComposerAttachmentClientPersistEnabled(): boolean {
  return isAttachmentsV2ClientEnabled() || isDocumentsV1ClientEnabled();
}

export type ComposerDocumentsMode =
  | "off"
  | "legacy_v1"
  | "attachments_v2"
  | "mixed_v1_v2";

export function resolveComposerDocumentsMode(): ComposerDocumentsMode {
  const v1 = isComposerDocumentsV1Enabled();
  const v2 = isAttachmentsV2ServerEnabled();
  if (v2 && v1) return "mixed_v1_v2";
  if (v2) return "attachments_v2";
  if (v1) return "legacy_v1";
  return "off";
}

/**
 * يمنع واجهة V2 مع خادم Legacy:
 * إن كان العميل يطلب V2 والخادم بلا ATTACHMENTS_V2 → لا تعتمد مسار V2 خادميًا.
 */
export type ClientServerFlagAlignment = {
  clientWantsV2: boolean;
  serverHasV2: boolean;
  /** هل يُنفَّذ مسار V2 فعليًا على الخادم لهذا الطلب */
  enforceV2: boolean;
  /** هل يُسمح للعميل بمحاولة الرفع (قد يفشل إن الخادم off) */
  clientMayPersist: boolean;
  /** تحذير محاذاة */
  misaligned: boolean;
  reason: string;
};

export function alignClientServerDocumentFlags(input?: {
  clientClaimsV2?: boolean;
}): ClientServerFlagAlignment {
  const clientWantsV2 =
    typeof input?.clientClaimsV2 === "boolean"
      ? input.clientClaimsV2
      : isAttachmentsV2ClientEnabled();
  const serverHasV2 = isAttachmentsV2ServerEnabled();
  const clientMayPersist = isComposerAttachmentClientPersistEnabled();

  if (clientWantsV2 && !serverHasV2) {
    return {
      clientWantsV2,
      serverHasV2,
      enforceV2: false,
      clientMayPersist,
      misaligned: true,
      reason: "CLIENT_V2_SERVER_LEGACY",
    };
  }
  if (!clientWantsV2 && serverHasV2) {
    return {
      clientWantsV2,
      serverHasV2,
      enforceV2: true, // الخادم يفرض V2 عند وصول attachmentIds
      clientMayPersist,
      misaligned: true,
      reason: "SERVER_V2_CLIENT_LEGACY",
    };
  }
  return {
    clientWantsV2,
    serverHasV2,
    enforceV2: serverHasV2,
    clientMayPersist,
    misaligned: false,
    reason: serverHasV2 ? "ALIGNED_V2" : isComposerDocumentsV1Enabled() ? "ALIGNED_V1" : "OFF",
  };
}

/** @deprecated استخدم isComposerAttachmentClientPersistEnabled */
export function isComposerDocumentsClientEnabled(): boolean {
  return isComposerAttachmentClientPersistEnabled();
}
