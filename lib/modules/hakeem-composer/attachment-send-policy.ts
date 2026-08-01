/**
 * قرار إرسال المرفق إلى agent-search — يفصل المعاينة المحلية عن المعالجة الخادمية.
 */
import type { ComposerAttachment } from "@/lib/modules/hakeem-composer/types";

export const SERVER_PENDING_STATUSES = new Set([
  "UPLOADED",
  "QUEUED",
  "DOWNLOADING",
  "SECURITY_SCAN",
  "EXTRACTING",
  "OCR",
  "QUALITY_CHECK",
  "PENDING",
]);

export type AskAttachmentSendPlan = {
  attachmentIds: string[];
  /** نص يُرسل في body.document — فقط مسار legacy أو CLIENT_FALLBACK صريح بلا ids خادمية معلّقة */
  document: string | null;
  /** يوجد مرفق خادمي لم يجهز بعد */
  hasPendingServerAttachment: boolean;
  /** هل يُمنع إرسال النص المحلي (معاينة) */
  suppressLocalDocument: boolean;
  reason: string;
};

export function isServerPendingStatus(status?: string | null): boolean {
  if (!status) return false;
  return SERVER_PENDING_STATUSES.has(String(status).toUpperCase());
}

/**
 * هل المرفق جاهز للاستخدام في النموذج (ليس مجرد معاينة محلية)؟
 */
export function isAttachmentReadyForModel(att: ComposerAttachment): boolean {
  if (!att.serverAttachmentId) {
    return att.status === "ready" && Boolean(att.extractedText?.trim());
  }
  const ver = att.serverVerificationStatus;
  const sp = (att.serverProcessingStatus || "").toUpperCase();
  if (ver === "PREVIEW_ONLY" || ver === "CLIENT_PREVIEW") return false;
  if (isServerPendingStatus(sp)) return false;
  if (sp === "FAILED" || sp === "QUARANTINED") return false;
  // SERVER_VERIFIED أو CLIENT_UNVERIFIED (fallback) مع READY/PARTIAL
  if (sp === "READY" || sp === "PARTIAL") return true;
  // توافق: إن لم يُعرف التحقق لكن الحالة ready واجهةً بعد fallback
  return att.status === "ready" && ver === "CLIENT_UNVERIFIED";
}

/**
 * يشتق حالة الواجهة من المحلي + الخادمي دون اختزال المعاينة إلى ready.
 */
export function deriveComposerAttachmentStatus(input: {
  localExtractionStatus?: ComposerAttachment["localExtractionStatus"];
  serverAttachmentId?: string;
  serverProcessingStatus?: string;
  serverVerificationStatus?: string;
  processingV2?: boolean;
}): ComposerAttachment["status"] {
  const local = input.localExtractionStatus;
  if (local === "failed") return "failed";
  if (local === "pending" || local === "extracting") return "processing";

  if (input.serverAttachmentId && input.processingV2 !== false) {
    const sp = (input.serverProcessingStatus || "").toUpperCase();
    const ver = input.serverVerificationStatus;
    if (sp === "FAILED" || sp === "QUARANTINED") return "failed";
    if (ver === "PREVIEW_ONLY" || isServerPendingStatus(sp) || !sp) return "processing";
    if (sp === "READY" || sp === "PARTIAL") return "ready";
    return "processing";
  }

  if (local === "ok") return "ready";
  return "queued";
}

/**
 * خطة الإرسال عند تفعيل ATTACHMENTS_V2 + PROCESSING_V2.
 */
export function planAskAttachmentSend(input: {
  attachments: ComposerAttachment[];
  attachmentsV2: boolean;
  processingV2: boolean;
}): AskAttachmentSendPlan {
  const list = input.attachments;
  const serverOnes = list.filter((a) => a.serverAttachmentId);
  const attachmentIds = serverOnes
    .map((a) => a.serverAttachmentId!)
    .filter(Boolean);

  if (input.attachmentsV2 && input.processingV2 && attachmentIds.length) {
    const pending = serverOnes.some(
      (a) =>
        a.serverVerificationStatus === "PREVIEW_ONLY" ||
        isServerPendingStatus(a.serverProcessingStatus) ||
        !isAttachmentReadyForModel(a)
    );
    // لا ترسل document inline — فقط ids
    return {
      attachmentIds,
      document: null,
      hasPendingServerAttachment: pending,
      suppressLocalDocument: true,
      reason: pending ? "SERVER_PENDING_IDS_ONLY" : "SERVER_IDS_ONLY",
    };
  }

  // CLIENT_FALLBACK / V2 بلا processing: إن كان الخادم كتب نصًا موثوقًا عبر ids
  if (input.attachmentsV2 && attachmentIds.length) {
    const allReady = serverOnes.every((a) => isAttachmentReadyForModel(a));
    if (allReady) {
      return {
        attachmentIds,
        document: null,
        hasPendingServerAttachment: false,
        suppressLocalDocument: true,
        reason: "SERVER_READY_IDS",
      };
    }
    const pending = serverOnes.some((a) => !isAttachmentReadyForModel(a));
    return {
      attachmentIds,
      document: null,
      hasPendingServerAttachment: pending,
      suppressLocalDocument: true,
      reason: "SERVER_IDS_PENDING",
    };
  }

  // Legacy محلي فقط
  const localReady = list.filter(
    (a) => !a.serverAttachmentId && a.status === "ready" && a.extractedText.trim()
  );
  const text =
    localReady.length === 0
      ? null
      : localReady.length === 1
        ? localReady[0].extractedText
        : localReady.map((a, i) => `—— المستند ${i + 1}: ${a.name} ——\n${a.extractedText}`).join("\n\n");

  return {
    attachmentIds: [],
    document: text,
    hasPendingServerAttachment: false,
    suppressLocalDocument: false,
    reason: text ? "LOCAL_INLINE" : "NONE",
  };
}

/** هل يمكن بدء الإرسال (سؤال أو مرجع مرفق)؟ */
export function canStartAskWithAttachments(
  attachments: ComposerAttachment[],
  question: string
): boolean {
  if (question.trim()) return true;
  return attachments.some(
    (a) =>
      Boolean(a.serverAttachmentId) ||
      (a.status === "ready" && Boolean(a.extractedText?.trim()))
  );
}
