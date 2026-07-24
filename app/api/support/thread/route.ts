import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/modules/auth/session";
import {
  appendMessage,
  getOrCreateOpenThread,
  listMessages,
  markReadByUser,
} from "@/lib/modules/support/support-store";
import { notifyAdminNewSupportMessage } from "@/lib/modules/support/notify";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  subject: z.string().trim().max(200).optional(),
});

/** GET — خيط المستخدم المفتوح + الرسائل (ينشئ خيطاً فارغاً عند الحاجة). */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }

  const thread = await getOrCreateOpenThread(user.id);
  if (!thread) {
    return NextResponse.json({ ok: false, message: "تعذّر فتح المحادثة." }, { status: 503 });
  }

  await markReadByUser(thread.id);
  const messages = await listMessages(thread.id);
  return NextResponse.json({
    ok: true,
    thread: { ...thread, unreadUser: 0 },
    messages,
  });
}

/** POST — إرسال رسالة من العميل. */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "نص الرسالة غير صالح." }, { status: 400 });
  }

  const thread = await getOrCreateOpenThread(user.id, parsed.data.subject);
  if (!thread) {
    return NextResponse.json({ ok: false, message: "تعذّر فتح المحادثة." }, { status: 503 });
  }

  const message = await appendMessage({
    threadId: thread.id,
    senderRole: "user",
    senderId: user.id,
    body: parsed.data.body,
  });
  if (!message) {
    return NextResponse.json({ ok: false, message: "تعذّر إرسال الرسالة." }, { status: 503 });
  }

  void notifyAdminNewSupportMessage({
    userName: user.name,
    userEmail: user.email,
    preview: parsed.data.body.slice(0, 280),
  });

  const messages = await listMessages(thread.id);
  return NextResponse.json({ ok: true, thread, message, messages });
}
