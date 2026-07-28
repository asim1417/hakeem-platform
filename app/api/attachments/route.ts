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

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  // عزل المستأجرين: المرفقات عبر ملكيّة القضية أو uploadedBy للمستخدم.
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
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ message: "اختر ملفًا صالحًا للرفع." }, { status: 400 });
  if (!isAllowedAttachmentMimeType(file.type)) {
    return NextResponse.json({ message: "نوع الملف غير مدعوم. الصيغ المتاحة: PDF, DOCX, TXT, PNG, JPG." }, { status: 400 });
  }

  const relationType = String(form.get("relationType") || "عام");
  const relationId = String(form.get("relationId") || "");
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  // منع ربط مرفق بقضية مستخدم آخر (IDOR على POST).
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

  // PR-1: metadata في العمود الصريح؛ extractedText يبقى null حتى تكتمل القراءة (لا JSON داخله).
  // الاستخراج والقراءة الضوئية خارج دورة طلب الرفع — لا استدعاء لمحركات الاستخراج هنا.
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
      processingStatus: attachment.processingStatus
    }
  });

  return NextResponse.json({ attachment: toAttachmentDto(attachment) }, { status: 201 });
}
