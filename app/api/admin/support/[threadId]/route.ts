import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import {
  appendMessage,
  closeThread,
  getThreadById,
  listMessages,
  markReadByAdmin,
} from "@/lib/modules/support/support-store";
import { notifyUserSupportReply } from "@/lib/modules/support/notify";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

type Ctx = { params: { threadId: string } };

/** GET — رسائل خيط واحد + تعليم كمقروء للأدمن. */
export async function GET(request: NextRequest, { params }: Ctx) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const thread = await getThreadById(params.threadId);
  if (!thread) {
    return NextResponse.json({ ok: false, message: "المحادثة غير موجودة." }, { status: 404 });
  }

  await markReadByAdmin(thread.id);
  const messages = await listMessages(thread.id);
  return NextResponse.json({
    ok: true,
    thread: { ...thread, unreadAdmin: 0 },
    messages,
  });
}

/** POST — رد السوبر أو إغلاق الخيط. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const thread = await getThreadById(params.threadId);
  if (!thread) {
    return NextResponse.json({ ok: false, message: "المحادثة غير موجودة." }, { status: 404 });
  }

  const json = await request.json().catch(() => null);
  if (json && typeof json === "object" && (json as { action?: string }).action === "close") {
    await closeThread(thread.id);
    return NextResponse.json({ ok: true, closed: true });
  }

  const parsed = replySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "نص الرد غير صالح." }, { status: 400 });
  }

  const message = await appendMessage({
    threadId: thread.id,
    senderRole: "admin",
    senderId: gate.user.id,
    body: parsed.data.body,
  });
  if (!message) {
    return NextResponse.json({ ok: false, message: "تعذّر إرسال الرد." }, { status: 503 });
  }

  if (thread.userEmail) {
    void notifyUserSupportReply({
      to: thread.userEmail,
      preview: parsed.data.body.slice(0, 280),
    });
  }

  const messages = await listMessages(thread.id);
  return NextResponse.json({ ok: true, message, messages });
}
