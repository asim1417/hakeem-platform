import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { getSystemUser } from "@/lib/modules/auth/system-user";
import { canUser } from "@/lib/modules/auth/rbac";
import { parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";

export const dynamic = "force-dynamic";

const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg"
]);

export async function GET() {
  const attachments = await prisma.attachment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { caseFile: { select: { id: true, title: true } } }
  });

  return NextResponse.json({ attachments: attachments.map(toDto) });
}

export async function POST(request: NextRequest) {
  const user = await getSystemUser();
  const allowed = await canUser(user.id, "ATTACHMENTS_FULL");
  if (!allowed) return NextResponse.json({ message: "لا تملك صلاحية إدارة المرفقات." }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "اختر ملفًا صالحًا للرفع." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ message: "نوع الملف غير مدعوم في نسخة MVP الحالية." }, { status: 400 });
  }

  const relationType = String(form.get("relationType") || "عام");
  const relationId = String(form.get("relationId") || "");
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  const metadata = {
    size: file.size,
    relationType,
    relationId: relationId || undefined,
    uploadedBy: user.id,
    storageMode: "metadata-only",
    note: "إدارة المرفقات الحالية تسجل بيانات الملف فقط. التخزين الدائم واستخراج النص TODO لاحق."
  };

  const attachment = await prisma.attachment.create({
    data: {
      caseId,
      fileName: file.name,
      mimeType: file.type,
      storageKey: `metadata-only/${Date.now()}-${file.name}`,
      extractedText: JSON.stringify(metadata)
    },
    include: { caseFile: { select: { id: true, title: true } } }
  });

  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_UPLOADED",
    entityId: attachment.id,
    metadata: {
      description: `تم تسجيل مرفق: ${attachment.fileName}`,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: file.size,
      relationType,
      relationId: relationId || undefined,
      storageMode: "metadata-only"
    }
  });

  return NextResponse.json({ attachment: toDto(attachment) }, { status: 201 });
}

function toDto(attachment: {
  id: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  extractedText: string | null;
  createdAt: Date;
  caseFile?: { id: string; title: string } | null;
}) {
  const metadata = parseAttachmentMetadata(attachment.extractedText);
  return {
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    storageKey: attachment.storageKey,
    createdAt: attachment.createdAt,
    caseFile: attachment.caseFile,
    ...metadata
  };
}
