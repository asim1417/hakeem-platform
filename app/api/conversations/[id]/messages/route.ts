import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireConversationService } from "@/lib/modules/conversations/api-auth";
import {
  appendMessage,
  ConversationEngineError,
  linkGenerationJob,
} from "@/lib/modules/conversations/engine";
import {
  conversationServiceSchema,
  messageAttachmentRefSchema,
  retrievedSourceSchema,
} from "@/lib/modules/conversations/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const postSchema = z.object({
  service: conversationServiceSchema,
  content: z.string().min(1),
  role: z.enum(["user", "assistant", "system", "tool"]).default("user"),
  mode: z.string().optional(),
  clientRequestId: z.string().min(8).max(128).optional(),
  status: z.enum(["pending", "streaming", "completed", "failed", "cancelled"]).optional(),
  attachments: z.array(messageAttachmentRefSchema).optional(),
  retrievedSources: z.array(retrievedSourceSchema).optional(),
  warnings: z.unknown().optional(),
  inputSnapshot: z.unknown().optional(),
  outputSnapshot: z.unknown().optional(),
  toolCalls: z.unknown().optional(),
  model: z.string().optional().nullable(),
  jobId: z.string().uuid().optional().nullable(),
  linkJob: z.boolean().optional(),
});

/**
 * POST /api/conversations/:id/messages? — إلحاق رسالة بجلسة قائمة.
 * يعزل بـ userId + serviceKey + conversationId.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "طلب غير صالح." }, { status: 400 });
  }

  const auth = await requireConversationService(request, body.service);
  if (!auth.ok) return auth.response;

  try {
    const result = await appendMessage({
      userId: auth.userId,
      serviceKey: auth.serviceKey,
      conversationId: params.id,
      role: body.role,
      content: body.content,
      mode: body.mode,
      clientRequestId: body.clientRequestId,
      status: body.status,
      attachments: body.attachments,
      retrievedSources: body.retrievedSources,
      warnings: body.warnings,
      inputSnapshot: body.inputSnapshot,
      outputSnapshot: body.outputSnapshot,
      toolCalls: body.toolCalls,
      model: body.model,
      jobId: body.jobId ?? null,
    });

    if (body.linkJob && body.jobId) {
      await linkGenerationJob({
        jobId: body.jobId,
        ownerId: auth.userId,
        conversationId: result.conversationId,
        messageId: result.messageId,
        serviceKey: auth.serviceKey,
        clientRequestId: body.clientRequestId,
      });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof ConversationEngineError) {
      const status =
        e.code === "NOT_FOUND" || e.code === "SERVICE_MISMATCH"
          ? 404
          : e.code === "DELETED"
            ? 410
            : e.code === "VALIDATION"
              ? 400
              : 400;
      return NextResponse.json({ ok: false, message: e.message, code: e.code }, { status });
    }
    console.error("[conversations.messages]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "تعذّر حفظ الرسالة." }, { status: 500 });
  }
}
