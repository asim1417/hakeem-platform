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
import { ATTACHMENTS_VERSION_HEADER } from "@/lib/modules/hakeem-composer/attachments-version";

export type PersistAskAttachmentResult = {
  serverAttachmentId: string;
  storageKey?: string;
  processingStatus?: string;
  extractionMode?: string;
  provenance?: string;
  verificationStatus?: string;
  rejectedAsLegacy?: boolean;
  rejectCode?: string;
};

export async function persistAskAttachmentToServer(input: {
  file: File;
  extractedText: string;
  kind?: string | null;
  signal?: AbortSignal;
}): Promise<PersistAskAttachmentResult | null> {
  if (!isComposerAttachmentClientPersistEnabled()) return null;

  const claimsV2 = isAttachmentsV2ClientEnabled();
  const versionHeaders: Record<string, string> = {};
  if (claimsV2) {
    versionHeaders[ATTACHMENTS_VERSION_HEADER] = "2";
  }

  try {
    const form = new FormData();
    form.set("file", input.file);
    form.set("relationType", ASK_ATTACHMENT_RELATION_TYPE);
    if (claimsV2) {
      form.set("attachmentsVersion", "2");
      form.set("clientFlag", "ATTACHMENTS_V2");
    }

    const up = await fetch("/api/attachments", {
      method: "POST",
      headers: versionHeaders,
      body: form,
      signal: input.signal,
    });
    if (!up.ok) {
      const err = (await up.json().catch(() => ({}))) as { code?: string };
      if (err.code === "CLIENT_V2_SERVER_LEGACY") {
        return {
          serverAttachmentId: "",
          rejectedAsLegacy: true,
          rejectCode: err.code,
        };
      }
      return null;
    }
    const upJson = (await up.json()) as {
      attachment?: { id?: string; storageKey?: string; processingStatus?: string };
      processing?: { status?: string; jobId?: string };
      enforceV2?: boolean;
    };
    const id = upJson.attachment?.id;
    if (!id) return null;

    const ex = await fetch(`/api/attachments/${id}/extraction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...versionHeaders },
      body: JSON.stringify({
        text: input.extractedText,
        kind: input.kind ?? undefined,
        attachmentsVersion: claimsV2 ? "2" : undefined,
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
      verificationStatus: exJson.verificationStatus,
    };
  } catch {
    return null;
  }
}
