/**
 * POST /api/attachments/[id]/extraction
 * يُكمل استخراج نص المرفق بنص قادم من extractFile (بدون إعادة بناء OCR).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { completeAttachmentExtraction } from "@/lib/modules/attachments/complete-extraction";
import { ASK_ATTACHMENT_RELATION_TYPE } from "@/lib/modules/hakeem-composer/document-bridge";
import { prisma } from "@/lib/prisma";
import { ownsAttachment } from "@/lib/modules/auth/ownership";
import { resolveAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // LIMITED يكفي لمرفقات Ask اليتيمة؛ FULL يغطيها عبر rbac.
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  let body: {
    text?: string;
    kind?: string;
    extractionEngine?: string;
    confidence?: number;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "جسم الطلب غير صالح." }, { status: 400 });
  }

  // تحقق ملكية سريع + تمييز مرفق Ask (للاستخدام في التدقيق فقط)
  const existing = await prisma.attachment.findUnique({
    where: { id: params.id },
    include: { caseFile: { select: { ownerId: true } } },
  });
  if (
    !existing ||
    !ownsAttachment(user, {
      caseId: existing.caseId,
      caseOwnerId: existing.caseFile?.ownerId ?? null,
      extractedText: existing.extractedText,
      metadata: existing.metadata,
    })
  ) {
    return NextResponse.json({ message: "لم يتم العثور على المرفق." }, { status: 404 });
  }

  const meta = resolveAttachmentMetadata(existing.extractedText, existing.metadata);
  const isAsk =
    meta.relationType === ASK_ATTACHMENT_RELATION_TYPE || meta.relationType === "ask";

  // مرفقات القضايا تتطلب FULL إن لم تكن Ask يتيمة — LIMITED يكفي لـ Ask
  if (!isAsk && existing.caseId) {
    const full = await requireApiPermission("ATTACHMENTS_FULL", request);
    if (full.response) return full.response;
  }

  const result = await completeAttachmentExtraction({
    attachmentId: params.id,
    user,
    rawText: String(body.text ?? ""),
    kind: body.kind,
    extractionEngine: body.extractionEngine,
    confidence: body.confidence,
  });

  if (!result.ok) {
    const status = result.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ message: result.message, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    attachmentId: result.attachmentId,
    processingStatus: result.processingStatus,
    textLength: result.textLength,
    preview: result.preview,
    needsOcr: result.needsOcr,
    source: result.source,
  });
}
