/**
 * جسر مرفقات Ask ↔ نظام Attachment القائم.
 * لا يعيد بناء OCR — يعيد استخدام extractFile / processExtractedText / Attachment.
 */
import { processExtractedText, type TextSource } from "@/lib/modules/document-inspection/pipeline";
import type { ComposerAttachment } from "./types";
import type { MessageAttachmentRef } from "@/lib/modules/conversations/types";
import { COMPOSER_MAX_DOC_CHARS } from "./constants";

export {
  isComposerDocumentsV1Enabled,
  isComposerDocumentsClientEnabled,
  isComposerAttachmentClientPersistEnabled,
  isAttachmentsV2ClientEnabled,
  isAttachmentsV2ServerEnabled,
  isDocumentProcessingV2Enabled,
  alignClientServerDocumentFlags,
  resolveComposerDocumentsMode,
} from "./document-flags";

export {
  planAskAttachmentSend,
  deriveComposerAttachmentStatus,
  isAttachmentReadyForModel,
  canStartAskWithAttachments,
} from "./attachment-send-policy";

export { ATTACHMENTS_VERSION_HEADER } from "./attachments-version";

export {
  COMPOSER_CAPABILITIES,
  resolveComposerCapabilities,
  getCapability,
  capabilityRegistryStats,
} from "./capability-registry";

export {
  buildUnifiedCitationSet,
  formatAttachmentPageCitation,
  fromRetrievedSource,
  renderUnifiedCitationsMarkdown,
} from "./unified-citations";

export { suggestJdsHandoff, isComposerJdsHandoffEnabled } from "./jds-handoff";

export { resolveComposerCaseContext, isComposerCaseContextEnabled } from "./case-context-bridge";

export function mapExtractKindToTextSource(kind: string | null | undefined): TextSource {
  const k = (kind || "").toLowerCase();
  if (k.includes("cloud") || k.includes("gemini") || k.includes("vision")) return "cloud";
  if (k.includes("ocr") || k.includes("tesseract") || k.includes("scan")) return "ocr";
  return "digital-layer";
}

/**
 * يوحّد تنظيف النص عبر دماغ منصة الوثائق قبل الحفظ/الإرسال.
 */
export function finalizeComposerExtractedText(
  raw: string,
  kind?: string | null
): { text: string; needsOcr: boolean; source: TextSource } {
  const source = mapExtractKindToTextSource(kind);
  const processed = processExtractedText(raw, { source });
  const text = (processed.body || raw || "").trim();
  return { text, needsOcr: processed.needsOcr, source };
}

export function combineComposerDocuments(
  items: Array<{ name: string; text: string }>
): { text: string; name: string | null } {
  const ready = items.filter((a) => a.text.trim());
  if (!ready.length) return { text: "", name: null };
  if (ready.length === 1) {
    return {
      text: ready[0].text.slice(0, COMPOSER_MAX_DOC_CHARS),
      name: ready[0].name,
    };
  }
  const text = ready
    .map((a, i) => `—— المستند ${i + 1}: ${a.name} ——\n${a.text}`)
    .join("\n\n");
  return {
    text: text.slice(0, COMPOSER_MAX_DOC_CHARS),
    name: `${ready.length} مستندات`,
  };
}

/** معاينة محدودة للرسائل — لا نكرّر كامل النص في ChatMessage عند وجود Attachment.id */
export const MESSAGE_ATTACHMENT_TEXT_PREVIEW = 2_000;

/**
 * Adapter: ComposerAttachment → MessageAttachmentRef
 * يفضّل معرف المرفق الخادمي ويقلّص النص عند الجاهزية الخادمية.
 */
export function toMessageAttachmentRef(
  att: ComposerAttachment,
  opts?: { preferServerId?: boolean; previewOnly?: boolean }
): MessageAttachmentRef {
  const preferServer = opts?.preferServerId !== false;
  const serverId = att.serverAttachmentId;
  const id = preferServer && serverId ? serverId : att.id;
  const previewOnly = opts?.previewOnly ?? Boolean(serverId);
  const extractedText = previewOnly
    ? att.extractedText.slice(0, MESSAGE_ATTACHMENT_TEXT_PREVIEW)
    : att.extractedText.slice(0, 200_000);

  return {
    id,
    fileName: att.name,
    mimeType: att.mimeType,
    size: att.size,
    storageKey: att.storageKey,
    extractedText: extractedText || undefined,
    processingStatus: serverId ? "ready" : "inline",
  };
}

/**
 * يبني نص المستند للوكيل من مرفقات خادمية و/أو نص الطلب (توافق خلفي).
 * الأولوية: نصوص المرفقات المحمّلة خادميًا إن وُجدت، وإلا body.document.
 */
export function resolveAskDocumentText(input: {
  requestDocument?: string | null;
  attachmentDocuments?: Array<{ fileName: string; text: string }>;
}): { text: string; source: "attachments" | "request" | "merged" | "none"; attachmentCount: number } {
  const fromAtts = combineComposerDocuments(
    (input.attachmentDocuments ?? []).map((a) => ({ name: a.fileName, text: a.text }))
  );
  const fromReq = String(input.requestDocument ?? "").trim();

  if (fromAtts.text && fromReq && fromAtts.text !== fromReq) {
    // عند وجود الاثنين: نعتمد المرفقات الخادمية (مصدر حقيقة) ونتجاهل تكرار العميل
    return {
      text: fromAtts.text,
      source: "attachments",
      attachmentCount: input.attachmentDocuments?.length ?? 0,
    };
  }
  if (fromAtts.text) {
    return {
      text: fromAtts.text,
      source: "attachments",
      attachmentCount: input.attachmentDocuments?.length ?? 0,
    };
  }
  if (fromReq) {
    return { text: fromReq.slice(0, COMPOSER_MAX_DOC_CHARS), source: "request", attachmentCount: 0 };
  }
  return { text: "", source: "none", attachmentCount: 0 };
}

export const ASK_ATTACHMENT_RELATION_TYPE = "اسأل";
