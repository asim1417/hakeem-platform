import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import {
  isAllowedAttachmentMimeType,
  toAttachmentDto
} from "@/lib/modules/attachments/attachment-metadata";
import { getCurrentUser, requireApiPermission } from "@/lib/modules/auth/session";
import { assertCaseOwnedForAttachment, attachmentListWhere } from "@/lib/modules/auth/ownership";
import { storageBackend, uploadAttachmentBlob } from "@/lib/modules/attachments/blob-storage";
import { gateAdvancedUse, settleAdvancedUse } from "@/lib/modules/billing/access-gate";
import {
  isDocumentProcessingV2Enabled,
  queueAttachmentProcessing,
} from "@/lib/modules/attachments/document-processing-adapter";
import { ATTACHMENT_MAX_BYTES, validateAttachmentUpload } from "@/lib/modules/attachments/secure-upload";
import {
  assertAttachmentsV2RateLimitReady,
  buildAttachmentUploadRateKey,
  getAttachmentUploadRateLimiter,
} from "@/lib/modules/attachments/upload-rate-limit";
import { ASK_ATTACHMENT_RELATION_TYPE } from "@/lib/modules/hakeem-composer/document-bridge";
import {
  decideAttachmentsRuntime,
  readAttachmentsVersionClaim,
} from "@/lib/modules/hakeem-composer/attachments-version";
import { createHash } from "crypto";

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

/**
 * ترتيب الحماية:
 * 1) جلسة مستخدم
 * 2) Content-Length مبكر (إن وُجد)
 * 3) Rate limit
 * 4) قراءة FormData
 * 5) صلاحية ASK_ATTACHMENT_UPLOAD أو ATTACHMENTS_FULL
 * 6) تحقق البايتات الحقيقي
 *
 * قرار موثّق: ATTACHMENTS_LIMITED = عرض/تنزيل فقط.
 * رفع Ask اليتيم يستخدم ASK_ATTACHMENT_UPLOAD (أدق).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول.", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const cl = Number(contentLengthHeader);
    if (Number.isFinite(cl) && cl > ATTACHMENT_MAX_BYTES + 64_000) {
      // هامش لحقول FormData الأخرى
      return NextResponse.json(
        {
          message: `حجم الطلب يتجاوز الحد المعلن (${ATTACHMENT_MAX_BYTES.toLocaleString("ar-SA")} بايت).`,
          code: "CONTENT_LENGTH_EXCEEDED",
        },
        { status: 413 }
      );
    }
  }

  // محاذاة مبكرة من الترويسة قبل قراءة البايتات
  const headerClaim = readAttachmentsVersionClaim(request, null);
  const earlyRuntime = decideAttachmentsRuntime({ clientClaimsV2: headerClaim.clientClaimsV2 });
  if (!earlyRuntime.ok) {
    return NextResponse.json(
      {
        message: earlyRuntime.message,
        code: earlyRuntime.code,
        alignment: earlyRuntime.alignment,
      },
      { status: earlyRuntime.status }
    );
  }

  const prodRl = assertAttachmentsV2RateLimitReady();
  if (earlyRuntime.enforceV2 && !prodRl.ok) {
    return NextResponse.json(
      { message: prodRl.message, code: prodRl.code },
      { status: 503 }
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  const ipHash = ip
    ? createHash("sha256").update(ip).digest("hex").slice(0, 16)
    : null;
  const rate = await getAttachmentUploadRateLimiter().consume(
    buildAttachmentUploadRateKey(user.id, ipHash)
  );
  if (!rate.allowed) {
    return NextResponse.json(
      {
        message: "تجاوزت حد معدّل الرفع. حاول لاحقًا.",
        code: "RATE_LIMITED",
        limit: rate.limit,
        provider: rate.provider,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const form = await request.formData();
  const claim = readAttachmentsVersionClaim(request, form);
  const runtime = decideAttachmentsRuntime({ clientClaimsV2: claim.clientClaimsV2 });
  if (!runtime.ok) {
    return NextResponse.json(
      {
        message: runtime.message,
        code: runtime.code,
        alignment: runtime.alignment,
      },
      { status: runtime.status }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "اختر ملفًا صالحًا للرفع." }, { status: 400 });
  }

  const relationType = String(form.get("relationType") || "عام");
  const relationId = String(form.get("relationId") || "");
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  const isAskOrphan =
    !caseId &&
    (relationType === ASK_ATTACHMENT_RELATION_TYPE ||
      relationType === "ask" ||
      relationType === "ASK" ||
      relationType === "اسأل");

  // LIMITED لا يكفي للرفع — Ask يستخدم ASK_ATTACHMENT_UPLOAD؛ القضايا FULL
  const gate = await requireApiPermission(
    isAskOrphan ? "ASK_ATTACHMENT_UPLOAD" : "ATTACHMENTS_FULL",
    request
  );
  if (gate.response) return gate.response;
  const actor = gate.user!;
  const caseGate = await assertCaseOwnedForAttachment(actor, caseId);
  if (!caseGate.ok) return NextResponse.json({ message: caseGate.message }, { status: 403 });

  const v2 = runtime.enforceV2;
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

  // منع التكرار داخل نطاق ملكية المستخدم (V2)
  if (v2 && sha256) {
    const dup = await prisma.attachment.findFirst({
      where: {
        sha256,
        OR: [
          { metadata: { path: ["uploadedBy"], equals: actor.id } },
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

  const access = await gateAdvancedUse(actor.id, {
    serviceCode: "DOCUMENT_UPLOAD",
    idempotencyKey: `document-upload:${request.headers.get("idempotency-key") || crypto.randomUUID()}`
  });
  if (!access.allowed) {
    return NextResponse.json(
      { blocked: true, reason: "exhausted", message: access.message },
      { status: 402 }
    );
  }

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
    uploadedBy: actor.id,
    storageMode: uploaded.storageMode,
    storageUrl: uploaded.url,
    sha256: sha256 || undefined,
    detectedMimeType: detectedMimeType || undefined,
    attachmentsV2: v2 || undefined,
    flagAlignment: runtime.alignment.reason,
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
    actorId: actor.id,
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
      permissionUsed: isAskOrphan ? "ASK_ATTACHMENT_UPLOAD" : "ATTACHMENTS_FULL",
      flagAlignment: runtime.alignment.reason,
      rateLimitProvider: rate.provider,
    }
  });
  await settleAdvancedUse(actor.id, access.via, {
    reservationId: access.reservationId,
    referenceId: attachment.id
  });

  let processing = null;
  if (v2 && isDocumentProcessingV2Enabled() && backend !== "metadata-only") {
    processing = await queueAttachmentProcessing({
      attachmentId: attachment.id,
      user: actor,
      preferredProvider: "auto",
    }).catch(() => null);
  }

  return NextResponse.json(
    {
      attachment: toAttachmentDto(attachment),
      processing: processing || undefined,
      storageConfigured: backend !== "metadata-only",
      flagAlignment: runtime.alignment.reason,
      enforceV2: v2,
    },
    { status: 201 }
  );
}
