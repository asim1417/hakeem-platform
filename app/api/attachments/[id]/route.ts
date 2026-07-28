import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  resolveStoredAttachmentUrl,
  toAttachmentDto
} from "@/lib/modules/attachments/attachment-metadata";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { ownsAttachment } from "@/lib/modules/auth/ownership";
import { signedDownloadUrl } from "@/lib/modules/attachments/blob-storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { id: true, title: true, ownerId: true } } }
  });

  // [إصلاح تدقيق SEC-005 + مراجعة PR-1]: 404 عند عدم الملكيّة دون كشف الوجود.
  if (
    !attachment ||
    !ownsAttachment(gate.user!, {
      caseId: attachment.caseId,
      caseOwnerId: attachment.caseFile?.ownerId ?? null,
      extractedText: attachment.extractedText,
      metadata: attachment.metadata
    })
  ) {
    return NextResponse.json({ message: "لم يتم العثور على المرفق." }, { status: 404 });
  }
  const dto = toAttachmentDto(attachment);
  return NextResponse.json({
    attachment: {
      ...dto,
      downloadUrl: signedDownloadUrl(attachment.storageKey) ?? resolveStoredAttachmentUrl(attachment.extractedText, attachment.metadata)
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
  const existing = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { ownerId: true } } }
  });
  if (
    !existing ||
    !ownsAttachment(user, {
      caseId: existing.caseId,
      caseOwnerId: existing.caseFile?.ownerId ?? null,
      extractedText: existing.extractedText,
      metadata: existing.metadata
    })
  ) {
    return NextResponse.json({ message: "لم يتم العثور على المرفق." }, { status: 404 });
  }
  const attachment = await prisma.attachment.delete({ where: { id: params.id } });
  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_DELETED",
    entityId: params.id,
    metadata: { description: `تم حذف مرفق: ${attachment.fileName}`, fileName: attachment.fileName, storageKey: attachment.storageKey }
  });

  return NextResponse.json({ message: "تم حذف المرفق." });
}
