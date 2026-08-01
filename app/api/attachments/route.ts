import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  isAllowedAttachmentMimeType,
  toAttachmentDto
} from "@/lib/modules/attachments/attachment-metadata";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { assertCaseOwnedForAttachment, attachmentListWhere } from "@/lib/modules/auth/ownership";
import { storageBackend, uploadAttachmentBlob } from "@/lib/modules/attachments/blob-storage";
import { gateAdvancedUse, settleAdvancedUse } from "@/lib/modules/billing/access-gate";
import {
  isAttachmentsV2Enabled,
  isDocumentProcessingV2Enabled,
  queueAttachmentProcessing,
} from "@/lib/modules/attachments/document-processing-adapter";
import { validateAttachmentUpload } from "@/lib/modules/attachments/secure-upload";

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
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "اختر ملفًا صالحًا للرفع." }, { status: 400 });

  const v2 = isAttachmentsV2Enabled();
  let detectedMimeType = file.type || null;
  let sha256: string | null = null;
  let safeName = file.name;
  let fileSize = file.size;

  if (v2) {
    const validated = await validateAttachmentUpload({ file, reportedMimeType: file.type });
    if (!validated.ok) {
      return NextResponse.json(
        { message: validated.message, code: validated.code },
        { status: 400 }
      );
    }
    detectedMimeType = validated.detectedMimeType;
    sha256 = validated.sha256;
    safeName = validated.safeFileName;
    fileSize = validated.size;
  } else if (!isAllowedAttachmentMimeType(file.type)) {
    return NextResponse.json({ message: "نوع الملف غير مدعوم. الصيغ المتاحة: PDF, DOCX, TXT, PNG, JPG." }, { status: 400 });
  }

  const relationType = String(form.get("relationType") || "عام");
  const relationId = String(form.get("relationId") || "");
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  const isAskOrphan =
    !caseId && (relationType === "اسأل" || relationType === "ask" || relationType === "ASK");
  const gate = await requireApiPermission(isAskOrphan ? "ATTACHMENTS_LIMITED" : "ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const caseGate = await assertCaseOwnedForAttachment(user, caseId);
  if (!caseGate.ok) return NextResponse.json({ message: caseGate.message }, { status: 403 });

  // منع التكرار داخل نطاق ملكية المستخدم (V2)
  if (v2 && sha256) {
    const dup = await prisma.attachment.findFirst({
      where: {
        sha256,
        OR: [
          { metadata: { path: ["uploadedBy"], equals: user.id } },
          ...(caseId ? [{ caseId }] : []),
        ],
      },
      include: { caseFile: { select: { id: true, title: true } } },
    });
    if (dup) {
      return NextResponse.json(
        {
          attachment: toAttachmentDto(dup),
          deduplicated: true,
          message: "مرفق مطابق موجود مسبقًا (SHA-256).",
        },
        { status: 200 }
      );
    }
  }

  const access = await gateAdvancedUse(user.id, {
    serviceCode: "DOCUMENT_UPLOAD",
    idempotencyKey: `document-upload:${request.headers.get("idempotency-key") || crypto.randomUUID()}`
  });
  if (!access.allowed) {
    return NextResponse.json(
      { blocked: true, reason: "exhausted", message: access.message },
      { status: 402 }
    );
  }

  // إعادة تسمية آمنة للملف قبل الرفع
  const uploadFile =
    safeName !== file.name
      ? new File([await file.arrayBuffer()], safeName, { type: detectedMimeType || file.type })
      : file;

  const uploaded = await uploadAttachmentBlob({ file: uploadFile, prefix: relationType });
  const backend = storageBackend();

  const metadata = {
    size: fileSize,
    relationType,
    relationId: relationId || undefined,
    uploadedBy: user.id,
    storageMode: uploaded.storageMode,
    storageUrl: uploaded.url,
    sha256: sha256 || undefined,
    detectedMimeType: detectedMimeType || undefined,
    attachmentsV2: v2 || undefined,
    note: isAskOrphan
      ? "مرفق Ask — معالجة عبر Adapter/doc-node أو جسر الاستخراج"
      : v2
        ? "رفع محمّى V2"
        : "TODO: استخراج نص PDF/DOCX لاحقًا وربطه بتحليل الاستشارة والمحاكاة."
  };

  const attachment = await prisma.attachment.create({
    data: {
      caseId,
      fileName: safeName,
      mimeType: detectedMimeType || file.type || "application/octet-stream",
      storageKey: uploaded.storageKey,
      extractedText: null,
      metadata,
      processingStatus: "UPLOADED",
      sourceProvider: "LOCAL_UPLOAD",
      fileSize: BigInt(fileSize),
      detectedMimeType: detectedMimeType,
      sha256: sha256,
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
      size: fileSize,
      relationType,
      relationId: relationId || undefined,
      storageMode: uploaded.storageMode,
      processingStatus: attachment.processingStatus,
      askOrphan: isAskOrphan || undefined,
      sha256: sha256 || undefined,
      attachmentsV2: v2 || undefined,
    }
  });
  await settleAdvancedUse(user.id, access.via, {
    reservationId: access.reservationId,
    referenceId: attachment.id
  });

  let processing = null;
  if (v2 && isDocumentProcessingV2Enabled() && backend !== "metadata-only") {
    processing = await queueAttachmentProcessing({
      attachmentId: attachment.id,
      user,
      preferredProvider: "auto",
    }).catch(() => null);
  }

  return NextResponse.json(
    {
      attachment: toAttachmentDto(attachment),
      processing: processing || undefined,
      storageConfigured: backend !== "metadata-only",
    },
    { status: 201 }
  );
}
