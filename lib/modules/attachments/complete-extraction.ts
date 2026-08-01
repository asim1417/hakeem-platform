/**
 * إكمال استخراج نص المرفق — يكتب extractedText ويضبط READY.
 * يستقبل نصًا مُستخرَجًا من extractFile (لا يعيد بناء OCR).
 */
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { ownsAttachment } from "@/lib/modules/auth/ownership";
import type { SafeUser } from "@/lib/modules/auth/session";
import {
  finalizeComposerExtractedText,
  MESSAGE_ATTACHMENT_TEXT_PREVIEW,
} from "@/lib/modules/hakeem-composer/document-bridge";
import { COMPOSER_MAX_DOC_CHARS } from "@/lib/modules/hakeem-composer/constants";

type Actor = Pick<SafeUser, "id" | "role">;

export type CompleteExtractionInput = {
  attachmentId: string;
  user: Actor;
  rawText: string;
  kind?: string | null;
  extractionEngine?: string | null;
  confidence?: number | null;
};

export type CompleteExtractionResult =
  | {
      ok: true;
      attachmentId: string;
      processingStatus: "READY" | "PARTIAL";
      textLength: number;
      preview: string;
      needsOcr: boolean;
      source: string;
    }
  | { ok: false; code: "NOT_FOUND" | "EMPTY_TEXT" | "INVALID"; message: string };

export async function completeAttachmentExtraction(
  input: CompleteExtractionInput
): Promise<CompleteExtractionResult> {
  const raw = String(input.rawText ?? "").trim();
  if (raw.length < 2) {
    return { ok: false, code: "EMPTY_TEXT", message: "نص الاستخراج فارغ أو قصير جدًا." };
  }

  const existing = await prisma.attachment.findUnique({
    where: { id: input.attachmentId },
    include: { caseFile: { select: { ownerId: true } } },
  });
  if (
    !existing ||
    !ownsAttachment(input.user, {
      caseId: existing.caseId,
      caseOwnerId: existing.caseFile?.ownerId ?? null,
      extractedText: existing.extractedText,
      metadata: existing.metadata,
    })
  ) {
    return { ok: false, code: "NOT_FOUND", message: "لم يتم العثور على المرفق." };
  }

  const finalized = finalizeComposerExtractedText(raw, input.kind);
  if (finalized.text.length < 2) {
    return { ok: false, code: "EMPTY_TEXT", message: "تعذّر تنظيف نص صالح من الاستخراج." };
  }

  const stored = finalized.text.slice(0, COMPOSER_MAX_DOC_CHARS);
  const status = stored.length < finalized.text.length ? "PARTIAL" : "READY";
  const now = new Date();

  const prevMeta =
    existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
      ? (existing.metadata as Record<string, unknown>)
      : {};

  await prisma.attachment.update({
    where: { id: existing.id },
    data: {
      extractedText: stored,
      processingStatus: status,
      extractionEngine: input.extractionEngine || finalized.source,
      extractionConfidence:
        typeof input.confidence === "number" && Number.isFinite(input.confidence)
          ? input.confidence
          : null,
      extractionErrorCode: null,
      extractionStartedAt: existing.extractionStartedAt ?? now,
      extractionCompletedAt: now,
      metadata: {
        ...prevMeta,
        extractionSource: finalized.source,
        extractionKind: input.kind ?? null,
        needsOcr: finalized.needsOcr,
        note: "استخراج مكتمل عبر جسر Ask/منصة الوثائق (processExtractedText).",
      },
    },
  });

  void auditEvent({
    actorId: input.user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_EXTRACTION_COMPLETED",
    entityId: existing.id,
    metadata: {
      fileName: existing.fileName,
      processingStatus: status,
      textLength: stored.length,
      engine: input.extractionEngine || finalized.source,
      source: finalized.source,
    },
  }).catch(() => undefined);

  return {
    ok: true,
    attachmentId: existing.id,
    processingStatus: status,
    textLength: stored.length,
    preview: stored.slice(0, MESSAGE_ATTACHMENT_TEXT_PREVIEW),
    needsOcr: finalized.needsOcr,
    source: finalized.source,
  };
}

/**
 * يحمّل نصوص مرفقات مملوكة للمستخدم لاستخدامها في agent-search.
 */
export async function loadOwnedAttachmentDocuments(input: {
  user: Actor;
  attachmentIds: string[];
}): Promise<Array<{ id: string; fileName: string; text: string; storageKey: string }>> {
  const ids = [...new Set(input.attachmentIds.map(String).filter(Boolean))].slice(0, 10);
  if (!ids.length) return [];

  const rows = await prisma.attachment.findMany({
    where: { id: { in: ids } },
    include: { caseFile: { select: { ownerId: true } } },
  });

  const out: Array<{ id: string; fileName: string; text: string; storageKey: string }> = [];
  for (const row of rows) {
    if (
      !ownsAttachment(input.user, {
        caseId: row.caseId,
        caseOwnerId: row.caseFile?.ownerId ?? null,
        extractedText: row.extractedText,
        metadata: row.metadata,
      })
    ) {
      continue;
    }
    const text = String(row.extractedText ?? "").trim();
    if (text.length < 2) continue;
    if (text.startsWith("{") && text.includes('"uploadedBy"')) continue;
    out.push({
      id: row.id,
      fileName: row.fileName,
      text: text.slice(0, COMPOSER_MAX_DOC_CHARS),
      storageKey: row.storageKey,
    });
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return out;
}
