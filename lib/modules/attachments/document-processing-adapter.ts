/**
 * Adapter موحّد: Attachment الدائم ↔ doc-node / استخراج محلي خفيف ↔ processExtractedText.
 * لا يعيد بناء OCR. لا OCR ثقيل داخل طلب Vercel — يُصفّ ويُزامَن.
 */
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { ownsAttachment } from "@/lib/modules/auth/ownership";
import type { SafeUser } from "@/lib/modules/auth/session";
import { processExtractedText } from "@/lib/modules/document-inspection/pipeline";
import { COMPOSER_MAX_DOC_CHARS } from "@/lib/modules/hakeem-composer/constants";
import { downloadAttachmentBytes, storageBackend } from "@/lib/modules/attachments/blob-storage";
import { completeAttachmentExtraction, provenanceFromDocNodeKind } from "@/lib/modules/attachments/complete-extraction";
import {
  isAttachmentsV2ServerEnabled,
  isDocumentProcessingV2Enabled,
  isDocNodeCallbackEnabled,
} from "@/lib/modules/hakeem-composer/document-flags";
import type { DocumentPageResult } from "@/lib/modules/attachments/extraction-provenance";

type Actor = Pick<SafeUser, "id" | "role">;

export type { DocumentPageResult };

export type DocumentProcessingRequest = {
  attachmentId: string;
  user: Actor;
  preferredProvider?: "auto" | "local" | "gemini" | "qari";
  preferredModel?: string;
  pageRange?: { from?: number; to?: number };
  forceReprocess?: boolean;
};

export type DocumentProcessingResult = {
  attachmentId: string;
  status: string;
  text?: string;
  runningText?: string;
  pageCount?: number;
  pages?: DocumentPageResult[];
  engine?: string;
  provider?: string;
  model?: string;
  confidence?: number;
  warnings?: string[];
  failedPages?: number[];
  errorCode?: string;
  errorMessage?: string;
  jobId?: string;
  mode?: "doc-node" | "local-fallback" | "client-bridge" | "noop";
  provenance?: string;
  verificationStatus?: string;
};

export function isAttachmentsV2Enabled(): boolean {
  return isAttachmentsV2ServerEnabled();
}

export { isDocumentProcessingV2Enabled, isDocNodeCallbackEnabled };

function docNodeBaseUrl(): string | null {
  const raw = (process.env.DOC_NODE_URL || process.env.DOC_TOOL_URL || "").trim().replace(/\/$/, "");
  return raw || null;
}

function docNodePassword(): string {
  return (process.env.DOC_NODE_PASSWORD || process.env.DOC_TOOL_PASSWORD || process.env.APP_PASSWORD || "").trim();
}

function asMeta(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

/** يستخرج صفحات بسيطة من علامات [صفحة N] إن وُجدت */
export function parsePagesFromText(text: string): DocumentPageResult[] {
  const parts = text.split(/\[صفحة\s+(\d+)\]/g);
  if (parts.length < 3) {
    return text.trim()
      ? [{ pageNumber: 1, text: text.trim(), status: "ready" as const }]
      : [];
  }
  const pages: DocumentPageResult[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const pageNumber = Number(parts[i]);
    const body = (parts[i + 1] || "").trim();
    if (!Number.isFinite(pageNumber)) continue;
    pages.push({
      pageNumber,
      text: body,
      status: body.length >= 2 ? "ready" : "partial",
    });
  }
  return pages;
}

async function updateAttachmentStatus(
  id: string,
  status: string,
  patch: Record<string, unknown> = {},
  metaPatch: Record<string, unknown> = {}
) {
  const row = await prisma.attachment.findUnique({ where: { id }, select: { metadata: true } });
  const metadata = { ...asMeta(row?.metadata), ...metaPatch };
  await prisma.attachment.update({
    where: { id },
    data: {
      processingStatus: status as never,
      metadata: metadata as object,
      ...(patch as object),
    } as never,
  });
}

/**
 * ينشئ مهمة doc-node من بايتات الملف.
 */
export async function enqueueDocNodeJob(input: {
  fileName: string;
  bytes: Uint8Array;
  provider: string;
  model: string;
}): Promise<{ ok: true; jobId: string } | { ok: false; code: string; message: string }> {
  const base = docNodeBaseUrl();
  if (!base) {
    return { ok: false, code: "DOC_NODE_NOT_CONFIGURED", message: "خدمة doc-node غير مضبوطة (DOC_TOOL_URL)." };
  }
  const form = new FormData();
  form.set("provider", input.provider);
  form.set("model", input.model);
  const filePart = new File([Buffer.from(input.bytes)], input.fileName, {
    type: "application/octet-stream",
  });
  form.set("files", filePart);

  const headers: Record<string, string> = {};
  const pw = docNodePassword();
  if (pw) headers["x-app-password"] = pw;

  const res = await fetch(`${base}/api/jobs`, {
    method: "POST",
    headers,
    body: form,
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    return {
      ok: false,
      code: "DOC_NODE_JOB_FAILED",
      message: `فشل إنشاء مهمة doc-node (${res.status}).`,
    };
  }
  const json = (await res.json()) as { job_id?: string };
  if (!json.job_id) {
    return { ok: false, code: "DOC_NODE_JOB_FAILED", message: "استجابة doc-node بلا job_id." };
  }
  return { ok: true, jobId: json.job_id };
}

export async function fetchDocNodeJob(
  jobId: string,
  withText: boolean
): Promise<{
  status: string;
  files: Array<{ name: string; status: string; kind?: string; text?: string; err?: string }>;
} | null> {
  const base = docNodeBaseUrl();
  if (!base) return null;
  const headers: Record<string, string> = {};
  const pw = docNodePassword();
  if (pw) headers["x-app-password"] = pw;
  const res = await fetch(`${base}/api/jobs/${encodeURIComponent(jobId)}${withText ? "?text=1" : ""}`, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as {
    status: string;
    files: Array<{ name: string; status: string; kind?: string; text?: string; err?: string }>;
  };
}

/**
 * يصفّ المرفق للمعالجة. لا ينتظر OCR الثقيل.
 */
export async function queueAttachmentProcessing(
  input: DocumentProcessingRequest
): Promise<DocumentProcessingResult> {
  if (!isDocumentProcessingV2Enabled()) {
    return {
      attachmentId: input.attachmentId,
      status: "UPLOADED",
      mode: "noop",
      warnings: ["HAKEEM_DOCUMENT_PROCESSING_V2 معطّل."],
    };
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
    return {
      attachmentId: input.attachmentId,
      status: "FAILED",
      errorCode: "ATTACHMENT_FORBIDDEN",
      errorMessage: "المرفق غير موجود أو غير مملوك.",
    };
  }

  const meta = asMeta(existing.metadata);
  if (
    !input.forceReprocess &&
    (existing.processingStatus === "READY" || existing.processingStatus === "PARTIAL") &&
    existing.extractedText
  ) {
    return {
      attachmentId: existing.id,
      status: existing.processingStatus,
      text: existing.extractedText,
      engine: existing.extractionEngine ?? undefined,
      mode: "noop",
      pages: Array.isArray(meta.pages) ? (meta.pages as DocumentPageResult[]) : undefined,
    };
  }

  if (storageBackend() === "metadata-only" && existing.storageKey.startsWith("metadata-only/")) {
    await updateAttachmentStatus(existing.id, "FAILED", {
      extractionErrorCode: "STORAGE_NOT_CONFIGURED",
      extractionCompletedAt: new Date(),
    }, {
      ...meta,
      processingError: "STORAGE_NOT_CONFIGURED",
    });
    return {
      attachmentId: existing.id,
      status: "FAILED",
      errorCode: "STORAGE_NOT_CONFIGURED",
      errorMessage: "التخزين غير مُعدّ — لا يمكن معالجة البايتات خادميًا.",
      mode: "noop",
    };
  }

  const nextGeneration =
    (typeof meta.docNodeGeneration === "number" ? meta.docNodeGeneration : 0) + 1;
  await updateAttachmentStatus(existing.id, "QUEUED", {
    extractionStartedAt: existing.extractionStartedAt ?? new Date(),
    extractionErrorCode: null,
  }, {
    ...meta,
    queuedAt: new Date().toISOString(),
    docNodeGeneration: nextGeneration,
    authoritativeSource: "doc-node",
  });

  const bytes = await downloadAttachmentBytes(existing.storageKey, {
    sharePointUrl: typeof meta.storageUrl === "string" ? meta.storageUrl : null,
  }).catch(() => null);
  if (!bytes || !bytes.length) {
    await updateAttachmentStatus(existing.id, "FAILED", {
      extractionErrorCode: "BYTES_UNAVAILABLE",
      extractionCompletedAt: new Date(),
    });
    return {
      attachmentId: existing.id,
      status: "FAILED",
      errorCode: "BYTES_UNAVAILABLE",
      errorMessage: "تعذّر جلب بايتات المرفق من التخزين.",
    };
  }

  const provider =
    input.preferredProvider && input.preferredProvider !== "auto"
      ? input.preferredProvider
      : "local";
  const model = input.preferredModel || "flash";

  const job = await enqueueDocNodeJob({
    fileName: existing.fileName,
    bytes,
    provider,
    model,
  });

  if (!job.ok) {
    // Fallback محلي خفيف للنص/docx فقط — لا OCR ثقيل على Vercel
    try {
      const { extractLocal, RemoteNeeded } = await import("../../../services/doc-node/extract");
      try {
        await updateAttachmentStatus(existing.id, "EXTRACTING");
        const local = await extractLocal(existing.fileName, bytes);
        const processed = processExtractedText(local.text, {
          source: local.kind.includes("OCR") ? "ocr" : "digital-layer",
        });
        const pages = parsePagesFromText(processed.body);
        const completed = await completeAttachmentExtraction({
          attachmentId: existing.id,
          user: input.user,
          rawText: processed.body,
          kind: local.kind,
          provenance: "SERVER_LOCAL",
          provider: "local",
          model: local.kind,
          pages,
          runningText: processed.running ?? null,
          docNodeConfigured: false,
        });
        if (completed.ok) {
          await prisma.attachment.update({
            where: { id: existing.id },
            data: {
              metadata: {
                ...asMeta((await prisma.attachment.findUnique({ where: { id: existing.id }, select: { metadata: true } }))?.metadata),
                pages,
                runningText: processed.running ?? null,
                pageCount: pages.length,
                processingMode: "local-fallback",
                authoritativeSource: "server-local",
              },
            },
          });
          return {
            attachmentId: existing.id,
            status: completed.processingStatus,
            text: completed.text,
            pages: completed.pages ?? pages,
            pageCount: pages.length,
            engine: completed.provenance,
            provider: "local",
            mode: "local-fallback",
            runningText: processed.running,
            provenance: completed.provenance,
            verificationStatus: completed.verificationStatus,
            confidence: undefined,
          };
        }
      } catch (e) {
        if (!(e instanceof RemoteNeeded)) throw e;
        await updateAttachmentStatus(existing.id, "FAILED", {
          extractionErrorCode: "REMOTE_OCR_REQUIRED",
          extractionCompletedAt: new Date(),
        }, {
          docNodeError: job.message,
          needsRemoteOcr: true,
        });
        return {
          attachmentId: existing.id,
          status: "FAILED",
          errorCode: "REMOTE_OCR_REQUIRED",
          errorMessage: "يحتاج محرك رؤية بعيد وdoc-node غير متاح.",
          mode: "local-fallback",
        };
      }
    } catch {
      /* ignore */
    }
    await updateAttachmentStatus(existing.id, "FAILED", {
      extractionErrorCode: job.code,
      extractionCompletedAt: new Date(),
    });
    return {
      attachmentId: existing.id,
      status: "FAILED",
      errorCode: job.code,
      errorMessage: job.message,
    };
  }

  await updateAttachmentStatus(existing.id, "EXTRACTING", {}, {
    docNodeJobId: job.jobId,
    docNodeProvider: provider,
    docNodeModel: model,
    docNodeGeneration: nextGeneration,
    processingMode: "doc-node",
    authoritativeSource: "doc-node",
  });

  void auditEvent({
    actorId: input.user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_PROCESSING_QUEUED",
    entityId: existing.id,
    metadata: { jobId: job.jobId, provider, model },
  }).catch(() => undefined);

  return {
    attachmentId: existing.id,
    status: "EXTRACTING",
    jobId: job.jobId,
    provider,
    model,
    mode: "doc-node",
  };
}

/**
 * يزامن حالة مهمة doc-node إلى Attachment. Idempotent.
 */
export async function syncAttachmentProcessing(
  input: DocumentProcessingRequest
): Promise<DocumentProcessingResult> {
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
    return {
      attachmentId: input.attachmentId,
      status: "FAILED",
      errorCode: "ATTACHMENT_FORBIDDEN",
      errorMessage: "المرفق غير موجود أو غير مملوك.",
    };
  }

  const meta = asMeta(existing.metadata);
  const jobId = typeof meta.docNodeJobId === "string" ? meta.docNodeJobId : null;
  const verification = meta.verificationStatus;

  if (!jobId) {
    return {
      attachmentId: existing.id,
      status: existing.processingStatus,
      text: existing.extractedText ?? undefined,
      engine: existing.extractionEngine ?? undefined,
      mode: "noop",
      provenance: typeof meta.extractionProvenance === "string" ? meta.extractionProvenance : undefined,
      verificationStatus: typeof verification === "string" ? verification : undefined,
    };
  }

  // لا يمنع ترقية CLIENT_UNVERIFIED؛ يمنع فقط إعادة كتابة SERVER_VERIFIED الجاهز بلا force
  if (
    !input.forceReprocess &&
    verification === "SERVER_VERIFIED" &&
    (existing.processingStatus === "READY" || existing.processingStatus === "PARTIAL") &&
    existing.extractedText
  ) {
    return {
      attachmentId: existing.id,
      status: existing.processingStatus,
      text: existing.extractedText,
      jobId,
      mode: "doc-node",
      pages: Array.isArray(meta.pages) ? (meta.pages as DocumentPageResult[]) : undefined,
      provenance: typeof meta.extractionProvenance === "string" ? meta.extractionProvenance : undefined,
      verificationStatus: "SERVER_VERIFIED",
    };
  }

  const job = await fetchDocNodeJob(jobId, true);
  if (!job) {
    return {
      attachmentId: existing.id,
      status: existing.processingStatus,
      jobId,
      errorCode: "DOC_NODE_SYNC_FAILED",
      errorMessage: "تعذّر مزامنة مهمة doc-node.",
      mode: "doc-node",
    };
  }

  if (job.status !== "done") {
    const busy = job.files.some((f) => f.status === "processing") ? "OCR" : "EXTRACTING";
    if (existing.processingStatus !== busy && existing.processingStatus !== "READY") {
      await updateAttachmentStatus(existing.id, busy, {}, { docNodeJobStatus: job.status });
    }
    return {
      attachmentId: existing.id,
      status: busy,
      jobId,
      mode: "doc-node",
      provider: typeof meta.docNodeProvider === "string" ? meta.docNodeProvider : undefined,
    };
  }

  const file = job.files[0];
  if (!file || file.status === "error" || file.status === "empty" || !file.text?.trim()) {
    await updateAttachmentStatus(existing.id, "FAILED", {
      extractionErrorCode: "PROCESSING_FAILED",
      extractionCompletedAt: new Date(),
    }, {
      docNodeFileError: file?.err ?? "empty",
      docNodeJobStatus: "done",
    });
    return {
      attachmentId: existing.id,
      status: "FAILED",
      jobId,
      errorCode: "ATTACHMENT_PROCESSING_FAILED",
      errorMessage: file?.err || "فشلت معالجة الملف.",
      mode: "doc-node",
    };
  }

  const processed = processExtractedText(file.text, {
    source: (file.kind || "").toLowerCase().includes("gemini") || (file.kind || "").toLowerCase().includes("qari")
      ? "cloud"
      : "digital-layer",
  });
  const pages = parsePagesFromText(processed.body);
  const failedPages = pages.filter((p) => p.status === "failed").map((p) => p.pageNumber);
  const hasPartial = pages.some((p) => p.status === "partial" || p.status === "failed");
  const provenance = provenanceFromDocNodeKind(file.kind);

  const completed = await completeAttachmentExtraction({
    attachmentId: existing.id,
    user: input.user,
    rawText: processed.body.slice(0, COMPOSER_MAX_DOC_CHARS),
    kind: file.kind,
    provenance,
    provider: typeof meta.docNodeProvider === "string" ? meta.docNodeProvider : "doc-node",
    model: typeof meta.docNodeModel === "string" ? meta.docNodeModel : file.kind,
    pages,
    runningText: processed.running ?? null,
    jobId,
    forceReprocess: input.forceReprocess,
    docNodeConfigured: true,
  });

  if (!completed.ok) {
    if (completed.code === "STALE_JOB") {
      return {
        attachmentId: existing.id,
        status: existing.processingStatus,
        jobId,
        mode: "doc-node",
        warnings: [completed.message],
        text: existing.extractedText ?? undefined,
      };
    }
    return {
      attachmentId: existing.id,
      status: "FAILED",
      jobId,
      errorCode: completed.code,
      errorMessage: completed.message,
      mode: "doc-node",
    };
  }

  // PARTIAL إذا وُجدت صفحات فاشلة — لا نعرضها READY
  const finalStatus = hasPartial || completed.processingStatus === "PARTIAL" ? "PARTIAL" : "READY";
  const freshMeta = asMeta(
    (await prisma.attachment.findUnique({ where: { id: existing.id }, select: { metadata: true } }))?.metadata
  );
  await prisma.attachment.update({
    where: { id: existing.id },
    data: {
      processingStatus: finalStatus,
      metadata: {
        ...freshMeta,
        pages,
        pageCount: pages.length,
        runningText: processed.running ?? null,
        failedPages,
        docNodeJobStatus: "done",
        processingMode: "doc-node",
        authoritativeSource: "doc-node",
      },
    },
  });

  void auditEvent({
    actorId: input.user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_PROCESSING_SYNCED",
    entityId: existing.id,
    metadata: {
      jobId,
      status: finalStatus,
      pageCount: pages.length,
      engine: file.kind,
      textLength: completed.textLength,
      provenance,
      // لا نص كامل
    },
  }).catch(() => undefined);

  return {
    attachmentId: existing.id,
    status: finalStatus,
    text: completed.text,
    pages: completed.pages ?? pages,
    pageCount: pages.length,
    failedPages,
    engine: `doc-node:${file.kind || "unknown"}`,
    provider: typeof meta.docNodeProvider === "string" ? meta.docNodeProvider : undefined,
    model: typeof meta.docNodeModel === "string" ? meta.docNodeModel : undefined,
    jobId,
    mode: "doc-node",
    runningText: processed.running,
    provenance: completed.provenance,
    verificationStatus: completed.verificationStatus,
    confidence: undefined,
    warnings: hasPartial ? ["بعض الصفحات جزئية أو فاشلة."] : undefined,
  };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}
