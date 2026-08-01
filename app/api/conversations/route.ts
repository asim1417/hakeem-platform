import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireConversationService } from "@/lib/modules/conversations/api-auth";
import {
  appendMessage,
  ConversationEngineError,
  listConversations,
} from "@/lib/modules/conversations/engine";
import {
  conversationServiceSchema,
  messageAttachmentRefSchema,
  retrievedSourceSchema,
} from "@/lib/modules/conversations/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/conversations?service=ask
 * قائمة جلسات خفيفة للمستخدم الحالي والخدمة فقط.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const auth = await requireConversationService(request, url.searchParams.get("service"));
  if (!auth.ok) return auth.response;

  try {
    const result = await listConversations({
      userId: auth.userId,
      serviceKey: auth.serviceKey,
      q: url.searchParams.get("q") ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") === "1",
      offset: url.searchParams.get("offset") ? Number(url.searchParams.get("offset")) : undefined,
      take: url.searchParams.get("take") ? Number(url.searchParams.get("take")) : undefined,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[conversations.list]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "تعذّر جلب الجلسات." }, { status: 500 });
  }
}

const postSchema = z.object({
  service: conversationServiceSchema,
  /** عند أول رسالة فقط — يُنشئ الجلسة */
  content: z.string().min(1),
  role: z.enum(["user", "assistant", "system", "tool"]).default("user"),
  mode: z.string().optional(),
  clientRequestId: z.string().min(8).max(128).optional(),
  judicialCaseId: z.string().uuid().optional().nullable(),
  caseFileId: z.string().min(1).optional().nullable(),
  attachments: z.array(messageAttachmentRefSchema).optional(),
  retrievedSources: z.array(retrievedSourceSchema).optional(),
  status: z.enum(["pending", "streaming", "completed", "failed", "cancelled"]).optional(),
  statePatch: z.record(z.unknown()).optional(),
  /** لقطة مدخلات الطلب (مصادر/سياسة/وضع) — توافق خلفي اختياري */
  inputSnapshot: z.record(z.unknown()).optional(),
});

/**
 * POST /api/conversations
 * إنشاء جلسة مع أول رسالة (لا صف فارغ).
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "طلب غير صالح." }, { status: 400 });
  }

  const auth = await requireConversationService(request, body.service);
  if (!auth.ok) return auth.response;

  if (auth.serviceKey === "judicial-assistant" && !body.judicialCaseId) {
    return NextResponse.json(
      { ok: false, message: "judicialCaseId مطلوب لإنشاء جلسة معاون قضائي." },
      { status: 400 }
    );
  }

  try {
    const result = await appendMessage({
      userId: auth.userId,
      serviceKey: auth.serviceKey,
      conversationId: null,
      role: body.role,
      content: body.content,
      mode: body.mode,
      clientRequestId: body.clientRequestId,
      judicialCaseId: body.judicialCaseId,
      caseFileId: body.caseFileId,
      attachments: body.attachments,
      retrievedSources: body.retrievedSources,
      status: body.status,
      statePatch: body.statePatch,
      inputSnapshot: body.inputSnapshot,
    });
    return NextResponse.json({ ok: true, ...result }, { status: result.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof ConversationEngineError) {
      const status =
        e.code === "VALIDATION" ? 400 : e.code === "CONFLICT" ? 409 : e.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ ok: false, message: e.message, code: e.code }, { status });
    }
    console.error("[conversations.create]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, message: "تعذّر إنشاء الجلسة." }, { status: 500 });
  }
}
