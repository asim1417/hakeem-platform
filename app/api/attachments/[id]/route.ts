import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { canUser } from "@/lib/modules/auth/rbac";
import { parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
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
      createdAt: attachment.createdAt,
      caseFile: attachment.caseFile,
      ...parseAttachmentMetadata(attachment.extractedText)
    }
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSystemUser();
  const allowed = await canUser(user.id, "ATTACHMENTS_FULL");
  if (!allowed) return NextResponse.json({ message: "لا تملك صلاحية حذف المرفقات." }, { status: 403 });

  const attachment = await prisma.attachment.delete({ where: { id: params.id } });
  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_DELETED",
    entityId: params.id,
    metadata: {
      description: `تم حذف مرفق: ${attachment.fileName}`,
      fileName: attachment.fileName
    }
  });

  return NextResponse.json({ message: "تم حذف المرفق." });
}
