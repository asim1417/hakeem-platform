/**
 * إكمال/تسجيل استخراج المرفق مع provenance وقواعد السباق.
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
import {
  CLIENT_EXTRACTION_MAX_CHARS,
  decideClientExtractionWrite,
  decideServerJobWrite,
  type DocumentPageResult,
  type ExtractionProvenance,
  isServerProvenance,
  provenanceFromDocNodeKind,
  verificationForProvenance,
} from "@/lib/modules/attachments/extraction-provenance";
import { isDocumentProcessingV2Enabled } from "@/lib/modules/hakeem-composer/document-flags";

type Actor = Pick<SafeUser, "id" | "role">;

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

export type CompleteExtractionInput = {
  attachmentId: string;
  user: Actor;
  rawText: string;
  kind?: string | null;
  /** يحدده الخادم فقط — يُتجاهل إن جاء من العميل */
  provenance: ExtractionProvenance;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  pages?: DocumentPageResult[];
  runningText?: string | null;
  jobId?: string | null;
  forceReprocess?: boolean;
  docNodeConfigured?: boolean;
};

export type CompleteExtractionResult =
  | {
      ok: true;
      attachmentId: string;
      processingStatus: "READY" | "PARTIAL" | string;
      text: string;
      textLength: number;
      preview: string;
      needsOcr: boolean;
      provenance: ExtractionProvenance;
      verificationStatus: string;
      pages?: DocumentPageResult[];
      mode: "wrote" | "preview_only";
    }
  | { ok: false; code: string; message: string };

export async function completeAttachmentExtraction(
  input: CompleteExtractionInput
): Promise<CompleteExtractionResult> {
  const raw = String(input.rawText ?? "").trim();
  if (raw.length < 2) {
    return { ok: false, code: "EMPTY_TEXT", message: "نص الاستخراج فارغ أو قصير جدًا." };
  }
  if (raw.length > CLIENT_EXTRACTION_MAX_CHARS && !isServerProvenance(input.provenance)) {
    return { ok: false, code: "TEXT_TOO_LARGE", message: "نص الاستخراج يتجاوز الحد المسموح." };
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

  const prevMeta = asMeta(existing.metadata);
  const finalized = finalizeComposerExtractedText(raw, input.kind);
  if (finalized.text.length < 2) {
    return { ok: false, code: "EMPTY_TEXT", message: "تعذّر تنظيف نص صالح من الاستخراج." };
  }
  const stored = finalized.text.slice(0, COMPOSER_MAX_DOC_CHARS);
  const pages = input.pages;
  const hasPartialPages = Boolean(pages?.some((p) => p.status === "partial" || p.status === "failed"));
  const status: "READY" | "PARTIAL" =
    stored.length < finalized.text.length || hasPartialPages ? "PARTIAL" : "READY";
  const now = new Date();
  const verificationStatus = verificationForProvenance(input.provenance);

  // —— مسار عميل ——
  if (!isServerProvenance(input.provenance)) {
    const decision = decideClientExtractionWrite({
      processingStatus: existing.processingStatus,
      metadata: prevMeta,
      documentProcessingV2: isDocumentProcessingV2Enabled(),
      docNodeConfigured: Boolean(input.docNodeConfigured),
    });

    if (decision.action === "reject") {
      return { ok: false, code: decision.code, message: decision.reason };
    }

    if (decision.action === "preview_only") {
      await prisma.attachment.update({
        where: { id: existing.id },
        data: {
          metadata: {
            ...prevMeta,
            clientPreviewText: stored.slice(0, MESSAGE_ATTACHMENT_TEXT_PREVIEW),
            clientPreviewAt: now.toISOString(),
            clientPreviewKind: input.kind ?? null,
            extractionProvenancePreview: input.provenance,
            lastClientWriteDecision: decision.reason,
          } as object,
        } as never,
      });
      void auditEvent({
        actorId: input.user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_CLIENT_PREVIEW_SAVED",
        entityId: existing.id,
        metadata: {
          provenance: input.provenance,
          reason: decision.reason,
          textLength: stored.length,
          // لا نص
        },
      }).catch(() => undefined);
      return {
        ok: true,
        attachmentId: existing.id,
        processingStatus: existing.processingStatus,
        text: existing.extractedText ?? "",
        textLength: (existing.extractedText ?? "").length,
        preview: stored.slice(0, MESSAGE_ATTACHMENT_TEXT_PREVIEW),
        needsOcr: finalized.needsOcr,
        provenance: input.provenance,
        verificationStatus: "PREVIEW_ONLY",
        mode: "preview_only",
      };
    }

    // fallback_write
    await prisma.attachment.update({
      where: { id: existing.id },
      data: {
        extractedText: stored,
        processingStatus: status,
        extractionEngine: `client-fallback:${input.kind || "browser"}`,
        extractionConfidence: null, // العميل لا يقرر الثقة
        extractionErrorCode: null,
        extractionStartedAt: existing.extractionStartedAt ?? now,
        extractionCompletedAt: now,
        metadata: {
          ...prevMeta,
          extractionProvenance: input.provenance,
          verificationStatus,
          extractionKind: input.kind ?? null,
          needsOcr: finalized.needsOcr,
          fallbackReason: decision.reason,
          note: "CLIENT_FALLBACK — غير موثق خادميًا.",
          pages: pages ?? prevMeta.pages ?? undefined,
          runningText: input.runningText ?? prevMeta.runningText ?? null,
        } as object,
      } as never,
    });

    void auditEvent({
      actorId: input.user.id,
      subject: "ADMIN",
      action: "ATTACHMENT_CLIENT_FALLBACK_WRITTEN",
      entityId: existing.id,
      metadata: {
        provenance: input.provenance,
        verificationStatus,
        reason: decision.reason,
        textLength: stored.length,
        processingStatus: status,
      },
    }).catch(() => undefined);

    return {
      ok: true,
      attachmentId: existing.id,
      processingStatus: status,
      text: stored,
      textLength: stored.length,
      preview: stored.slice(0, MESSAGE_ATTACHMENT_TEXT_PREVIEW),
      needsOcr: finalized.needsOcr,
      provenance: input.provenance,
      verificationStatus,
      pages,
      mode: "wrote",
    };
  }

  // —— مسار خادمي (doc-node / local) ——
  if (input.jobId) {
    const allow = decideServerJobWrite({
      incomingJobId: input.jobId,
      metadata: prevMeta,
      forceReprocess: input.forceReprocess,
    });
    if (!allow.allow) {
      return { ok: false, code: "STALE_JOB", message: allow.reason };
    }
  }

  const engineLabel =
    input.provenance === "SERVER_GEMINI"
      ? `doc-node:gemini:${input.model || "flash"}`
      : input.provenance === "SERVER_QARI"
        ? `doc-node:qari`
        : input.jobId
          ? `doc-node:local`
          : `server-local:${input.kind || "extract"}`;

  const generation = Number(prevMeta.docNodeGeneration ?? 1);

  await prisma.attachment.update({
    where: { id: existing.id },
    data: {
      extractedText: stored,
      processingStatus: status,
      extractionEngine: engineLabel,
      extractionConfidence:
        typeof input.confidence === "number" && Number.isFinite(input.confidence)
          ? input.confidence
          : null,
      extractionErrorCode: null,
      extractionStartedAt: existing.extractionStartedAt ?? now,
      extractionCompletedAt: now,
      metadata: {
        ...prevMeta,
        extractionProvenance: input.provenance,
        verificationStatus,
        extractionProvider: input.provider ?? null,
        extractionModel: input.model ?? null,
        extractionKind: input.kind ?? null,
        needsOcr: finalized.needsOcr,
        pages: pages ?? undefined,
        pageCount: pages?.length ?? prevMeta.pageCount ?? undefined,
        failedPages: pages?.filter((p) => p.status === "failed").map((p) => p.pageNumber) ?? [],
        runningText: input.runningText ?? null,
        docNodeJobId: input.jobId ?? prevMeta.docNodeJobId ?? null,
        docNodeCompletedGeneration: generation,
        note: "استخراج خادمي موثق عبر processExtractedText.",
      } as object,
    } as never,
  });

  void auditEvent({
    actorId: input.user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_EXTRACTION_COMPLETED",
    entityId: existing.id,
    metadata: {
      provenance: input.provenance,
      verificationStatus,
      processingStatus: status,
      textLength: stored.length,
      engine: engineLabel,
      jobId: input.jobId ?? undefined,
      pageCount: pages?.length,
      // لا نص
    },
  }).catch(() => undefined);

  return {
    ok: true,
    attachmentId: existing.id,
    processingStatus: status,
    text: stored,
    textLength: stored.length,
    preview: stored.slice(0, MESSAGE_ATTACHMENT_TEXT_PREVIEW),
    needsOcr: finalized.needsOcr,
    provenance: input.provenance,
    verificationStatus,
    pages,
    mode: "wrote",
  };
}

export { provenanceFromDocNodeKind };

/**
 * يحمّل نصوص مرفقات مملوكة للمستخدم لاستخدامها في agent-search.
 */
export async function loadOwnedAttachmentDocuments(input: {
  user: Actor;
  attachmentIds: string[];
}): Promise<
  Array<{
    id: string;
    fileName: string;
    text: string;
    storageKey: string;
    status?: string;
    pages?: DocumentPageResult[];
    provenance?: string;
  }>
> {
  const ids = [...new Set(input.attachmentIds.map(String).filter(Boolean))].slice(0, 10);
  if (!ids.length) return [];

  const rows = await prisma.attachment.findMany({
    where: { id: { in: ids } },
    include: { caseFile: { select: { ownerId: true } } },
  });

  const out: Array<{
    id: string;
    fileName: string;
    text: string;
    storageKey: string;
    status?: string;
    pages?: DocumentPageResult[];
    provenance?: string;
  }> = [];
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
    if (text.startsWith("{") && text.includes('"uploadedBy"')) continue;
    const meta = asMeta(row.metadata);
    const pages = Array.isArray(meta.pages) ? (meta.pages as DocumentPageResult[]) : undefined;
    out.push({
      id: row.id,
      fileName: row.fileName,
      text: text.slice(0, COMPOSER_MAX_DOC_CHARS),
      storageKey: row.storageKey,
      status: row.processingStatus,
      pages,
      provenance: typeof meta.extractionProvenance === "string" ? meta.extractionProvenance : undefined,
    });
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  out.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return out;
}
