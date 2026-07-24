import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/modules/auth/session";
import {
  appendMessage,
  countUnreadForUser,
  getOrCreateOpenThread,
  listMessages,
  markReadByUser,
} from "@/lib/modules/support/support-store";
import { notifyAdminNewSupportMessage } from "@/lib/modules/support/notify";
import { consumeSupportSendLimit } from "@/lib/modules/support/rate-limit";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  subject: z.string().trim().max(200).optional(),
});

/**
 * GET — خيط المستخدم + الرسائل (يفتح/يُنشئ عند الحاجة ويصفّر غير المقروء).
 * GET ?peek=1 — عداد غير مقروء فقط بلا إنشاء خيط وبلا تعليم كمقروء.
 */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }

  const peek = request.nextUrl.searchParams.get("peek") === "1";
  if (peek) {
    const unread = await countUnreadForUser(user.id);
    return NextResponse.json({ ok: true, unread });
  }

  const thread = await getOrCreateOpenThread(user.id, {
    userName: user.name,
    userEmail: user.email,
  });
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

  const rl = consumeSupportSendLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        ok: false,
        message: "أرسلت عددًا كبيرًا من الرسائل. انتظر دقيقة ثم أعد المحاولة.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "نص الرسالة غير صالح." }, { status: 400 });
  }

  const thread = await getOrCreateOpenThread(user.id, {
    subject: parsed.data.subject,
    userName: user.name,
    userEmail: user.email,
  });
  if (!thread) {
    return NextResponse.json({ ok: false, message: "تعذّر فتح المحادثة." }, { status: 503 });
  }

  const message = await appendMessage({
    threadId: thread.id,
    senderRole: "user",
    senderId: user.id,
    senderName: user.name,
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
