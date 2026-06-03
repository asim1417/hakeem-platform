import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { signedDownloadUrl } from "@/lib/modules/attachments/blob-storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { id: true, title: true } } }
  });

  if (!attachment) return NextResponse.json({ message: "لم يتم العثور على المرفق." }, { status: 404 });
  return NextResponse.json({
    attachment: {
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      storageKey: attachment.storageKey,
      downloadUrl: signedDownloadUrl(attachment.storageKey),
      createdAt: attachment.createdAt,
      caseFile: attachment.caseFile,
      ...parseAttachmentMetadata(attachment.extractedText)
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;
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
