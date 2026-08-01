/**
 * POST /api/attachments/[id]/extraction
 * نص عميل → CLIENT_PREVIEW أو CLIENT_FALLBACK فقط.
 * الخادم يحدد provenance/engine/confidence — لا يثق بمدخلات العميل.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { completeAttachmentExtraction } from "@/lib/modules/attachments/complete-extraction";
import { ASK_ATTACHMENT_RELATION_TYPE } from "@/lib/modules/hakeem-composer/document-bridge";
import {
  isAttachmentsV2ServerEnabled,
  isComposerDocumentsV1Enabled,
  isDocumentProcessingV2Enabled,
} from "@/lib/modules/hakeem-composer/document-flags";
import { CLIENT_EXTRACTION_MAX_CHARS } from "@/lib/modules/attachments/extraction-provenance";
import { prisma } from "@/lib/prisma";
import { ownsAttachment } from "@/lib/modules/auth/ownership";
import { resolveAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

function docNodeConfigured(): boolean {
  return Boolean((process.env.DOC_NODE_URL || process.env.DOC_TOOL_URL || "").trim());
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ASK_ATTACHMENT_UPLOAD", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  if (!isAttachmentsV2ServerEnabled() && !isComposerDocumentsV1Enabled()) {
    return NextResponse.json(
      { message: "مسار الاستخراج معطّل (أعلام الوثائق).", code: "FEATURE_DISABLED" },
      { status: 503 }
    );
  }

  let body: {
    text?: string;
    kind?: string;
    extractionEngine?: string;
    confidence?: number;
    /** يُتجاهل — الخادم يقرر */
    provenance?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "جسم الطلب غير صالح." }, { status: 400 });
  }

  const rawText = String(body.text ?? "");
  if (rawText.length > CLIENT_EXTRACTION_MAX_CHARS) {
    return NextResponse.json(
      { message: "نص الاستخراج يتجاوز الحد.", code: "TEXT_TOO_LARGE" },
      { status: 413 }
    );
  }

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

  if (!isAsk) {
    return NextResponse.json(
      {
        message: "مسار /extraction مخصص لمرفقات Ask فقط.",
        code: "ASK_ATTACHMENT_ONLY",
      },
      { status: 403 }
    );
  }

  // تجاهل extractionEngine/confidence من العميل صراحةً
  const processingV2 = isDocumentProcessingV2Enabled();
  const nodeOk = docNodeConfigured();
  const provenance =
    processingV2 && nodeOk ? ("CLIENT_PREVIEW" as const) : ("CLIENT_FALLBACK" as const);

  const result = await completeAttachmentExtraction({
    attachmentId: params.id,
    user,
    rawText,
    kind: body.kind,
    provenance,
    docNodeConfigured: nodeOk,
    // لا تمرير confidence/engine من العميل
  });

  void auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_CLIENT_EXTRACTION_POST",
    entityId: params.id,
    metadata: {
      provenance,
      mode: result.ok ? result.mode : "error",
      code: result.ok ? undefined : result.code,
      textLength: rawText.length,
      clientEngineIgnored: Boolean(body.extractionEngine),
      clientConfidenceIgnored: body.confidence != null,
      // لا نص
    },
  }).catch(() => undefined);

  if (!result.ok) {
    const status =
      result.code === "NOT_FOUND" ? 404 : result.code === "SERVER_AUTHORITATIVE" ? 409 : 400;
    return NextResponse.json({ message: result.message, code: result.code }, { status });
  }

  return NextResponse.json({
    ok: true,
    attachmentId: result.attachmentId,
    processingStatus: result.processingStatus,
    textLength: result.textLength,
    preview: result.preview,
    needsOcr: result.needsOcr,
    provenance: result.provenance,
    verificationStatus: result.verificationStatus,
    mode: result.mode,
  });
}
