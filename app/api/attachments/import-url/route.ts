import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { assertCaseOwnedForAttachment } from "@/lib/modules/auth/ownership";
import { auditEvent } from "@/lib/modules/audit/audit";
import { toAttachmentDto } from "@/lib/modules/attachments/attachment-metadata";
import { uploadAttachmentFromPath } from "@/lib/modules/attachments/blob-storage";
import {
  isDirectUrlImportEnabled,
  isDocumentRateLimitEnabled,
  isMalwareScanEnabled,
  isMalwareScanFailClosed
} from "@/lib/modules/documents/feature-flags";
import { getDocumentLimits } from "@/lib/modules/documents/document-limits";
import { getRateLimiter } from "@/lib/modules/rate-limit";
import { resolveConnectorForUrl } from "@/lib/modules/documents/connectors/registry";
import {
  cleanupDownloadedFile,
  DirectUrlError
} from "@/lib/modules/documents/connectors/direct-url";
import { redactSensitiveUrl, urlContainsSensitiveQuery } from "@/lib/modules/documents/url-security";
import { getMalwareScanner, scanAttachmentFile } from "@/lib/modules/documents/malware";
import { getDocumentJobDispatcher } from "@/lib/modules/documents/jobs/dispatcher";
import {
  beginIdempotentRequest,
  completeIdempotentRequest,
  failIdempotentRequest
} from "@/lib/modules/documents/idempotency";
import { createCorrelationId, documentLog } from "@/lib/modules/observability/document-logger";
import { recordDocumentMetric } from "@/lib/modules/observability/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(8).max(4000),
  relationType: z.string().max(40).optional(),
  relationId: z.string().max(80).optional()
});

function hashBody(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  const correlationId = createCorrelationId();
  if (!isDirectUrlImportEnabled()) {
    return NextResponse.json({ message: "لم يتم العثور على المورد." }, { status: 404 });
  }

  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  if (isDocumentRateLimitEnabled()) {
    const limits = getDocumentLimits();
    const rate = await getRateLimiter().consume({
      key: user.id,
      scope: "import-url",
      limit: limits.rateLimitImportMax,
      windowSeconds: limits.rateLimitWindowSeconds
    });
    if (!rate.allowed) {
      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_RATE_LIMITED",
        metadata: { scope: "import-url", correlationId }
      }).catch(() => undefined);
      recordDocumentMetric("document_rate_limited_total", 1, { provider: "DIRECT_URL", errorCode: "RATE_LIMITED" });
      return NextResponse.json(
        { message: "تجاوزت حد الطلبات. حاول لاحقًا.", code: "RATE_LIMITED", correlationId },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds ?? limits.rateLimitWindowSeconds) }
        }
      );
    }
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "جسم الطلب غير صالح." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: "مدخلات غير صالحة." }, { status: 400 });
  }

  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || undefined;
  const requestHash = hashBody({
    urlHost: (() => {
      try {
        return new URL(parsed.data.url).host;
      } catch {
        return "invalid";
      }
    })(),
    relationType: parsed.data.relationType || "عام",
    relationId: parsed.data.relationId || ""
  });

  let idempotencyRecordId: string | undefined;
  if (idempotencyKey) {
    const idem = await beginIdempotentRequest({
      userId: user.id,
      scope: "import-url",
      key: idempotencyKey,
      requestHash
    });
    if (idem.kind === "replay" && idem.responseBody) {
      return NextResponse.json(idem.responseBody, { status: idem.responseCode || 201 });
    }
    if (idem.kind === "conflict") {
      return NextResponse.json(
        { message: "مفتاح التكرار مستخدم بجسم مختلف.", code: "IDEMPOTENCY_CONFLICT", correlationId },
        { status: 409 }
      );
    }
    if (idem.kind === "in_progress") {
      return NextResponse.json(
        { message: "الطلب قيد المعالجة.", code: "IDEMPOTENCY_IN_PROGRESS", correlationId },
        { status: 409 }
      );
    }
    if (idem.kind !== "miss") {
      return NextResponse.json(
        { message: "تعذّر بدء طلب التكرار.", code: "IDEMPOTENCY_ERROR", correlationId },
        { status: 409 }
      );
    }
    idempotencyRecordId = idem.recordId;
  }

  const relationType = parsed.data.relationType || "عام";
  const relationId = parsed.data.relationId || "";
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  const caseGate = await assertCaseOwnedForAttachment(user, caseId);
  if (!caseGate.ok) {
    if (idempotencyRecordId) await failIdempotentRequest(idempotencyRecordId).catch(() => undefined);
    return NextResponse.json({ message: caseGate.message }, { status: 403 });
  }

  const { connector, provider, deferred } = resolveConnectorForUrl(parsed.data.url);
  if (deferred || !connector) {
    if (idempotencyRecordId) await failIdempotentRequest(idempotencyRecordId).catch(() => undefined);
    return NextResponse.json(
      {
        message: "هذا المزوّد غير مدعوم في هذه المرحلة. استخدم رابط HTTPS مباشرًا للملف.",
        provider,
        deferred: true,
        correlationId
      },
      { status: 400 }
    );
  }

  const safeHost = (() => {
    try {
      return new URL(parsed.data.url).host;
    } catch {
      return "unknown";
    }
  })();

  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_URL_IMPORT_STARTED",
    metadata: {
      host: safeHost,
      relationType,
      hadSensitiveQuery: urlContainsSensitiveQuery(parsed.data.url),
      correlationId
    }
  });

  let attachmentId: string | null = null;
  try {
    const placeholder = await prisma.attachment.create({
      data: {
        caseId,
        fileName: "importing...",
        mimeType: "application/octet-stream",
        storageKey: `pending/${Date.now()}`,
        extractedText: null,
        metadata: {
          relationType,
          relationId: relationId || undefined,
          uploadedBy: user.id,
          source: "direct-url",
          safeDisplayUrl: redactSensitiveUrl(parsed.data.url),
          correlationId
        },
        processingStatus: "DOWNLOADING",
        sourceProvider: "DIRECT_URL"
      }
    });
    attachmentId = placeholder.id;

    const downloaded = await connector.download({ url: parsed.data.url });
    try {
      const scanner = getMalwareScanner();
      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_MALWARE_SCAN_STARTED",
        entityId: placeholder.id,
        metadata: { correlationId, engine: scanner.constructor.name }
      }).catch(() => undefined);

      const scan = await scanAttachmentFile(downloaded.temporaryPath);
      recordDocumentMetric("document_malware_scan_total", 1, {
        provider: "DIRECT_URL",
        status: scan.status,
        engine: scan.engine
      });
      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_MALWARE_SCAN_COMPLETED",
        entityId: placeholder.id,
        metadata: { correlationId, status: scan.status, engine: scan.engine, durationMs: scan.durationMs }
      }).catch(() => undefined);

      if (scan.status === "INFECTED") {
        recordDocumentMetric("document_malware_detected_total", 1, {
          provider: "DIRECT_URL",
          engine: scan.engine,
          status: "INFECTED"
        });
        await prisma.attachment.update({
          where: { id: placeholder.id },
          data: {
            processingStatus: "QUARANTINED",
            extractionErrorCode: "MALWARE_DETECTED",
            fileName: downloaded.fileName.slice(0, 80),
            fileSize: BigInt(downloaded.size),
            sha256: downloaded.sha256
          }
        });
        await auditEvent({
          actorId: user.id,
          subject: "ADMIN",
          action: "ATTACHMENT_QUARANTINED",
          entityId: placeholder.id,
          metadata: { correlationId, reason: "MALWARE_DETECTED" }
        });
        throw new DirectUrlError("REMOTE_CONTENT_NOT_A_FILE", "تم عزل الملف لأسباب أمنية.");
      }

      if (scan.status === "ERROR" && isMalwareScanEnabled() && isMalwareScanFailClosed()) {
        await prisma.attachment.update({
          where: { id: placeholder.id },
          data: { processingStatus: "FAILED", extractionErrorCode: "MALWARE_SCAN_ERROR" }
        });
        throw new DirectUrlError("DOWNLOAD_INTERRUPTED", "تعذّر إكمال فحص الأمان.");
      }

      let uploaded;
      try {
        uploaded = await uploadAttachmentFromPath({
          filePath: downloaded.temporaryPath,
          fileName: downloaded.fileName,
          mimeType: downloaded.detectedMimeType,
          size: downloaded.size,
          prefix: relationType
        });
      } catch {
        throw new DirectUrlError("STORAGE_UPLOAD_FAILED", "تعذّر حفظ الملف في التخزين.");
      }

      const metadata = {
        size: downloaded.size,
        relationType,
        relationId: relationId || undefined,
        uploadedBy: user.id,
        storageMode: uploaded.storageMode,
        storageUrl: uploaded.url,
        source: "direct-url",
        safeDisplayUrl: redactSensitiveUrl(parsed.data.url),
        sha256Prefix: downloaded.sha256.slice(0, 12),
        correlationId,
        malwareStatus: scan.status
      };

      const attachment = await prisma.attachment.update({
        where: { id: placeholder.id },
        data: {
          fileName: downloaded.fileName,
          mimeType: downloaded.detectedMimeType,
          storageKey: uploaded.storageKey,
          extractedText: null,
          metadata,
          processingStatus: "UPLOADED",
          sourceProvider: "DIRECT_URL",
          sha256: downloaded.sha256,
          fileSize: BigInt(downloaded.size),
          detectedMimeType: downloaded.detectedMimeType
        },
        include: { caseFile: { select: { id: true, title: true } } }
      });

      const job = await getDocumentJobDispatcher().dispatch("DOCUMENT_IMPORTED", {
        attachmentId: attachment.id,
        userId: user.id,
        correlationId
      });
      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_JOB_DISPATCHED",
        entityId: attachment.id,
        metadata: { correlationId, jobId: job.jobId, type: "DOCUMENT_IMPORTED" }
      }).catch(() => undefined);

      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_URL_IMPORTED",
        entityId: attachment.id,
        metadata: {
          host: safeHost,
          fileName: attachment.fileName,
          size: downloaded.size,
          mimeType: downloaded.detectedMimeType,
          sha256Prefix: downloaded.sha256.slice(0, 12),
          storageMode: uploaded.storageMode,
          correlationId
        }
      });

      const responseBody = { attachment: toAttachmentDto(attachment), correlationId };
      if (idempotencyRecordId) {
        await completeIdempotentRequest({
          recordId: idempotencyRecordId,
          responseCode: 201,
          responseBody,
          entityId: attachment.id
        }).catch(() => undefined);
      }

      recordDocumentMetric("document_import_total", 1, { provider: "DIRECT_URL", status: "ok", mimeGroup: "file" });
      recordDocumentMetric("document_import_bytes_total", downloaded.size, { provider: "DIRECT_URL" });
      recordDocumentMetric("document_import_duration_ms", Date.now() - started, { provider: "DIRECT_URL" });
      documentLog({
        level: "info",
        event: "document.import.ok",
        correlationId,
        userId: user.id,
        attachmentId: attachment.id,
        jobId: job.jobId,
        provider: "DIRECT_URL",
        durationMs: Date.now() - started,
        bytes: downloaded.size,
        status: "ok"
      });

      return NextResponse.json(responseBody, { status: 201 });
    } finally {
      await cleanupDownloadedFile(downloaded);
    }
  } catch (err) {
    const code = err instanceof DirectUrlError ? err.code : "DOWNLOAD_FAILED";
    if (attachmentId) {
      const current = await prisma.attachment
        .findUnique({ where: { id: attachmentId }, select: { processingStatus: true } })
        .catch(() => null);
      if (current?.processingStatus !== "QUARANTINED") {
        await prisma.attachment
          .update({
            where: { id: attachmentId },
            data: {
              processingStatus: "FAILED",
              extractionErrorCode: code
            }
          })
          .catch(() => undefined);
      }
    }
    if (idempotencyRecordId) await failIdempotentRequest(idempotencyRecordId).catch(() => undefined);
    recordDocumentMetric("document_import_failed_total", 1, {
      provider: "DIRECT_URL",
      status: "failed",
      errorCode: code
    });
    documentLog({
      level: "error",
      event: "document.import.failed",
      correlationId,
      userId: user.id,
      attachmentId: attachmentId ?? undefined,
      provider: "DIRECT_URL",
      durationMs: Date.now() - started,
      status: "failed",
      errorCode: code
    });
    await auditEvent({
      actorId: user.id,
      subject: "ADMIN",
      action: "ATTACHMENT_URL_IMPORT_FAILED",
      entityId: attachmentId ?? undefined,
      metadata: { host: safeHost, code, correlationId }
    }).catch(() => undefined);

    if (err instanceof DirectUrlError) {
      return NextResponse.json(
        { message: err.message, code: err.code, reasonCode: err.securityReason, attachmentId, correlationId },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "تعذّر استيراد الرابط.", code, attachmentId, correlationId },
      { status: 502 }
    );
  }
}
