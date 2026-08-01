/**
 * POST/GET /api/attachments/[id]/process
 * يصفّ المعالجة لـ doc-node ويُزامن النتيجة — بلا OCR ثقيل في نفس الطلب الطويل.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import {
  isDocumentProcessingV2Enabled,
  queueAttachmentProcessing,
  syncAttachmentProcessing,
} from "@/lib/modules/attachments/document-processing-adapter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;
  if (!isDocumentProcessingV2Enabled()) {
    return NextResponse.json(
      { message: "معالجة الوثائق V2 معطّلة.", code: "DOCUMENT_PROCESSING_V2_OFF" },
      { status: 409 }
    );
  }

  let body: {
    preferredProvider?: "auto" | "local" | "gemini" | "qari";
    preferredModel?: string;
    forceReprocess?: boolean;
    syncOnly?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    /* جسم فارغ مقبول */
  }

  const result = body.syncOnly
    ? await syncAttachmentProcessing({
        attachmentId: params.id,
        user: gate.user!,
        forceReprocess: body.forceReprocess,
      })
    : await queueAttachmentProcessing({
        attachmentId: params.id,
        user: gate.user!,
        preferredProvider: body.preferredProvider,
        preferredModel: body.preferredModel,
        forceReprocess: body.forceReprocess,
      });

  const status =
    result.errorCode === "ATTACHMENT_FORBIDDEN"
      ? 404
      : result.errorCode === "STORAGE_NOT_CONFIGURED"
        ? 503
        : 200;

  return NextResponse.json(result, { status });
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("ATTACHMENTS_LIMITED", request);
  if (gate.response) return gate.response;

  const result = await syncAttachmentProcessing({
    attachmentId: params.id,
    user: gate.user!,
  });

  return NextResponse.json(result, {
    status: result.errorCode === "ATTACHMENT_FORBIDDEN" ? 404 : 200,
  });
}
