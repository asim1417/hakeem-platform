import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  isAllowedAttachmentMimeType,
  toAttachmentDto
} from "@/lib/modules/attachments/attachment-metadata";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { assertCaseOwnedForAttachment, attachmentListWhere } from "@/lib/modules/auth/ownership";
import { uploadAttachmentBlob } from "@/lib/modules/attachments/blob-storage";
import { getDocumentLimits } from "@/lib/modules/documents/document-limits";
import { consumeDocumentRateLimit } from "@/lib/modules/rate-limit";
import { incDocumentMetric } from "@/lib/modules/observability/metrics";
import { logDocumentEvent, newCorrelationId } from "@/lib/modules/observability/document-logger";
import { dispatchDocumentJob } from "@/lib/modules/documents/jobs/dispatcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const attachments = await prisma.attachment.findMany({
    where: attachmentListWhere(gate.user!),
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { caseFile: { select: { id: true, title: true } } }
  });

  return NextResponse.json({ attachments: attachments.map(toAttachmentDto) });
}

export async function POST(request: NextRequest) {
  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const correlationId = newCorrelationId();
  const limits = getDocumentLimits();

  const rate = await consumeDocumentRateLimit({
    userId: user.id,
    scope: "upload",
    limit: limits.rateLimitUploadMax,
    windowSeconds: limits.rateLimitWindowSeconds
  });
  if (!("skipped" in rate) && !rate.allowed) {
    await auditEvent({
      actorId: user.id,
      subject: "ADMIN",
      action: "ATTACHMENT_RATE_LIMITED",
      metadata: { scope: "upload", correlationId }
    }).catch(() => undefined);
    incDocumentMetric("document_rate_limited_total", { scope: "upload" });
    return NextResponse.json(
      { message: "تجاوزت حد الطلبات.", code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds ?? 1) } }
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "اختر ملفًا صالحًا للرفع." }, { status: 400 });
  if (!isAllowedAttachmentMimeType(file.type)) {
    return NextResponse.json({ message: "نوع الملف غير مدعوم. الصيغ المتاحة: PDF, DOCX, TXT, PNG, JPG." }, { status: 400 });
  }
  if (file.size > limits.maxUploadBytes) {
    return NextResponse.json({ message: "حجم الملف يتجاوز الحد المسموح.", code: "FILE_TOO_LARGE" }, { status: 413 });
  }

  const relationType = String(form.get("relationType") || "عام");
  const relationId = String(form.get("relationId") || "");
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  const caseGate = await assertCaseOwnedForAttachment(user, caseId);
  if (!caseGate.ok) return NextResponse.json({ message: caseGate.message }, { status: 403 });
  const uploaded = await uploadAttachmentBlob({ file, prefix: relationType });
  const metadata = {
    size: file.size,
    relationType,
    relationId: relationId || undefined,
    uploadedBy: user.id,
    storageMode: uploaded.storageMode,
    storageUrl: uploaded.url,
    note: "TODO: استخراج نص PDF/DOCX لاحقًا وربطه بتحليل الاستشارة والمحاكاة."
  };

  const attachment = await prisma.attachment.create({
    data: {
      caseId,
      fileName: file.name,
      mimeType: file.type,
      storageKey: uploaded.storageKey,
      extractedText: null,
      metadata,
      processingStatus: "UPLOADED",
      sourceProvider: "LOCAL_UPLOAD",
      fileSize: BigInt(file.size),
      detectedMimeType: file.type || null
    },
    include: { caseFile: { select: { id: true, title: true } } }
  });

  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_UPLOADED",
    entityId: attachment.id,
    metadata: {
      description: `تم رفع مرفق: ${attachment.fileName}`,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: file.size,
      relationType,
      relationId: relationId || undefined,
      storageMode: uploaded.storageMode,
      processingStatus: attachment.processingStatus,
      correlationId
    }
  });

  const job = await dispatchDocumentJob("DOCUMENT_IMPORTED", {
    attachmentId: attachment.id,
    userId: user.id,
    correlationId
  }).catch(() => null);
  if (job) {
    await auditEvent({
      actorId: user.id,
      subject: "ADMIN",
      action: "ATTACHMENT_JOB_DISPATCHED",
      entityId: attachment.id,
      metadata: { jobId: job.jobId, mode: job.mode, type: "DOCUMENT_IMPORTED", correlationId }
    }).catch(() => undefined);
  }

  logDocumentEvent({
    event: "attachment_uploaded",
    correlationId,
    userId: user.id,
    attachmentId: attachment.id,
    bytes: file.size,
    status: "UPLOADED",
    provider: "LOCAL_UPLOAD"
  });
  incDocumentMetric("document_import_total", { provider: "LOCAL_UPLOAD", status: "ok" });

  return NextResponse.json({ attachment: toAttachmentDto(attachment) }, { status: 201 });
}
