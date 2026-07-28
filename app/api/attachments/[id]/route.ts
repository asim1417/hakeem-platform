import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  resolveAttachmentMetadata,
  resolveStoredAttachmentUrl,
  toAttachmentDto
} from "@/lib/modules/attachments/attachment-metadata";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { isSystemAdmin } from "@/lib/modules/auth/ownership";
import { signedDownloadUrl } from "@/lib/modules/attachments/blob-storage";
import type { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";

// ملكيّة المرفق = ملكيّة القضية المرتبطة به. مرفق بلا قضية (ownerId=null) لا يقرؤه إلا المدير
// ما لم يُثبت uploadedBy في metadata / JSON القديم (تقوية غير كاسرة لمسار اليتيم).
function ownsAttachment(
  user: { id: string; role: UserRole | string },
  ownerId: string | null,
  extractedText: string | null,
  metadata: unknown
): boolean {
  if (isSystemAdmin({ id: user.id, role: user.role as UserRole })) return true;
  if (ownerId !== null && ownerId === user.id) return true;
  if (ownerId === null) {
    const meta = resolveAttachmentMetadata(extractedText, metadata);
    return meta.uploadedBy === user.id;
  }
  return false;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { id: true, title: true, ownerId: true } } }
  });

  // [إصلاح تدقيق SEC-005: كان بلا فحص ملكيّة → قراءة/تنزيل مرفقات مستخدمين آخرين.]
  if (
    !attachment ||
    !ownsAttachment(gate.user!, attachment.caseFile?.ownerId ?? null, attachment.extractedText, attachment.metadata)
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
  // [إصلاح تدقيق SEC-005: تحقّق من الملكيّة قبل الحذف — يمنع حذف مرفقات الغير.]
  const existing = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { ownerId: true } } }
  });
  if (
    !existing ||
    !ownsAttachment(user, existing.caseFile?.ownerId ?? null, existing.extractedText, existing.metadata)
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
