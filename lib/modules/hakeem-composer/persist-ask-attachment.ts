/**
 * عميل خفيف لإصرار مرفق Ask على /api/attachments دون إعادة بناء OCR.
 * فشل الشبكة/الصلاحية → null فيسقط المسار إلى inline.
 */
import {
  ASK_ATTACHMENT_RELATION_TYPE,
  isComposerDocumentsClientEnabled,
} from "@/lib/modules/hakeem-composer/document-bridge";

export type PersistAskAttachmentResult = {
  serverAttachmentId: string;
  storageKey?: string;
  processingStatus?: string;
};

export async function persistAskAttachmentToServer(input: {
  file: File;
  extractedText: string;
  kind?: string | null;
  signal?: AbortSignal;
}): Promise<PersistAskAttachmentResult | null> {
  if (!isComposerDocumentsClientEnabled()) return null;

  try {
    const form = new FormData();
    form.set("file", input.file);
    form.set("relationType", ASK_ATTACHMENT_RELATION_TYPE);

    const up = await fetch("/api/attachments", {
      method: "POST",
      body: form,
      signal: input.signal,
    });
    if (!up.ok) return null;
    const upJson = (await up.json()) as {
      attachment?: { id?: string; storageKey?: string };
    };
    const id = upJson.attachment?.id;
    if (!id) return null;

    const ex = await fetch(`/api/attachments/${id}/extraction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.extractedText,
        kind: input.kind ?? undefined,
        extractionEngine: input.kind ? `browser:${input.kind}` : "browser:extractFile",
      }),
      signal: input.signal,
    });
    if (!ex.ok) {
      // الرفع نجح لكن الاستخراج الخادمي فشل — نُبقي المعرف مع النص المحلي
      return {
        serverAttachmentId: id,
        storageKey: upJson.attachment?.storageKey,
        processingStatus: "UPLOADED",
      };
    }
    const exJson = (await ex.json()) as { processingStatus?: string };
    return {
      serverAttachmentId: id,
      storageKey: upJson.attachment?.storageKey,
      processingStatus: exJson.processingStatus ?? "READY",
    };
  } catch {
    return null;
  }
}
