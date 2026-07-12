import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { signedDownloadUrl } from "@/lib/modules/attachments/blob-storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const attachment = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { ownerId: true } } }
  });
  // [إصلاح تدقيق SEC-005: تحقّق من الملكيّة قبل إصدار رابط التنزيل الموقّع.]
  const isAdmin = gate.user!.role === "SYSTEM_ADMIN";
  const ownerId = attachment?.caseFile?.ownerId ?? null;
  if (!attachment || (!isAdmin && ownerId !== gate.user!.id)) {
    return NextResponse.json({ message: "لم يتم العثور على المرفق." }, { status: 404 });
  }
  // Azure: رابط موقّع. SharePoint: رابط webUrl المخزَّن في الميتاداتا.
  let url = signedDownloadUrl(attachment.storageKey);
  if (!url && attachment.storageKey.startsWith("sharepoint/")) {
    url = readStoredUrl(attachment.extractedText);
  }
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

function readStoredUrl(extractedText: string | null): string | null {
  if (!extractedText) return null;
  try {
    const meta = JSON.parse(extractedText) as { storageUrl?: string };
    return typeof meta.storageUrl === "string" && meta.storageUrl ? meta.storageUrl : null;
  } catch {
    return null;
  }
}
