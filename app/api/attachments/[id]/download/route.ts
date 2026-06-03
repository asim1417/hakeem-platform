import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { signedDownloadUrl } from "@/lib/modules/attachments/blob-storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const attachment = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!attachment) return NextResponse.json({ message: "لم يتم العثور على المرفق." }, { status: 404 });
  const url = signedDownloadUrl(attachment.storageKey);
  if (!url) return NextResponse.json({ message: "هذا المرفق مسجل metadata-only ولا يحتوي ملفًا مخزنًا للتنزيل." }, { status: 404 });

  await auditEvent({
    actorId: gate.user!.id,
    subject: "ADMIN",
    action: "ATTACHMENT_DOWNLOADED",
    entityId: attachment.id,
    metadata: { description: `تم طلب تنزيل مرفق: ${attachment.fileName}`, fileName: attachment.fileName }
  });

  return NextResponse.redirect(url);
}
