"use client";

import { FileText, Loader2, X } from "lucide-react";
import type { ComposerAttachment } from "@/lib/modules/hakeem-composer/types";

export function AttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: ComposerAttachment;
  onRemove: (id: string) => void;
}) {
  const ready = attachment.status === "ready";
  const failed = attachment.status === "failed" || attachment.status === "unsupported" || attachment.status === "encrypted";
  const processing =
    attachment.status === "processing" ||
    attachment.status === "uploading" ||
    attachment.status === "queued";

  return (
    <div
      className={`hkm-composer__att ${failed ? "hkm-composer__att--error" : ""}`}
      data-status={attachment.status}
    >
      <span className="hkm-composer__att-icon" aria-hidden>
        {processing ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
      </span>
      <div className="hkm-composer__att-body">
        <p className="hkm-composer__att-name">{attachment.name}</p>
        <p className="hkm-composer__att-meta">
          {failed
            ? attachment.error || "تعذّرت قراءة الملف"
            : processing
              ? attachment.progressMessage || "جارٍ المعالجة…"
              : ready
                ? `${attachment.extractedText.length.toLocaleString("ar-SA")} حرف${attachment.kind ? ` · ${attachment.kind}` : ""}`
                : attachment.status}
        </p>
      </div>
      <button
        type="button"
        className="hkm-composer__att-remove focus-ring"
        onClick={() => onRemove(attachment.id)}
        aria-label={`إزالة ${attachment.name}`}
      >
        <X size={12} aria-hidden />
      </button>
    </div>
  );
}

export function ComposerAttachments({
  attachments,
  onRemove,
}: {
  attachments: ComposerAttachment[];
  onRemove: (id: string) => void;
}) {
  if (!attachments.length) return null;
  return (
    <div className="hkm-composer__attachments" aria-label="المرفقات">
      {attachments.map((a) => (
        <AttachmentCard key={a.id} attachment={a} onRemove={onRemove} />
      ))}
    </div>
  );
}
