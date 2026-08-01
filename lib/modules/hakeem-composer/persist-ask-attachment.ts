/**
 * عميل خفيف لإصرار مرفق Ask على /api/attachments دون إعادة بناء OCR.
 * فشل الشبكة/الصلاحية → null فيسقط المسار إلى inline.
 *
 * عند DOCUMENT_PROCESSING_V2 + doc-node: نص المتصفح معاينة فقط (لا READY موثوق).
 */
import {
  ASK_ATTACHMENT_RELATION_TYPE,
  isComposerAttachmentClientPersistEnabled,
  isAttachmentsV2ClientEnabled,
} from "@/lib/modules/hakeem-composer/document-bridge";

export type PersistAskAttachmentResult = {
  serverAttachmentId: string;
  storageKey?: string;
  processingStatus?: string;
  extractionMode?: string;
  provenance?: string;
};

export async function persistAskAttachmentToServer(input: {
  file: File;
  extractedText: string;
  kind?: string | null;
  signal?: AbortSignal;
}): Promise<PersistAskAttachmentResult | null> {
  // قرار موحد: V2 client أو V1 client — لا يشترط DOCUMENTS_V1 لـ V2
  if (!isComposerAttachmentClientPersistEnabled()) return null;

  try {
    const form = new FormData();
    form.set("file", input.file);
    form.set("relationType", ASK_ATTACHMENT_RELATION_TYPE);
    if (isAttachmentsV2ClientEnabled()) {
      form.set("clientFlag", "ATTACHMENTS_V2");
    }

    const up = await fetch("/api/attachments", {
      method: "POST",
      body: form,
      signal: input.signal,
    });
    if (!up.ok) return null;
    const upJson = (await up.json()) as {
      attachment?: { id?: string; storageKey?: string; processingStatus?: string };
      processing?: { status?: string; jobId?: string };
    };
    const id = upJson.attachment?.id;
    if (!id) return null;

    // لا نرسل extractionEngine/confidence كبيانات موثوقة
    const ex = await fetch(`/api/attachments/${id}/extraction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.extractedText,
        kind: input.kind ?? undefined,
      }),
      signal: input.signal,
    });
    if (!ex.ok) {
      return {
        serverAttachmentId: id,
        storageKey: upJson.attachment?.storageKey,
        processingStatus: upJson.processing?.status ?? upJson.attachment?.processingStatus ?? "UPLOADED",
        extractionMode: "upload_only",
      };
    }
    const exJson = (await ex.json()) as {
      processingStatus?: string;
      mode?: string;
      provenance?: string;
      verificationStatus?: string;
    };
    return {
      serverAttachmentId: id,
      storageKey: upJson.attachment?.storageKey,
      processingStatus: exJson.processingStatus ?? upJson.processing?.status ?? "UPLOADED",
      extractionMode: exJson.mode,
      provenance: exJson.provenance,
    };
  } catch {
    return null;
  }
}
