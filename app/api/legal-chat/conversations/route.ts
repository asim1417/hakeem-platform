import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/legal-chat/conversations — سجل محادثات المستخدم (best-effort).
// يعيد قائمة فارغة بسلاسة إن لم تكن جداول الشات مُطبّقة على القاعدة بعد.
export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("LEGAL_CORE_VIEW", request);
  if (gate.response) return gate.response;
  const user = gate.user;
  if (!user) return NextResponse.json({ ok: true, conversations: [] });

  try {
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: {
        messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } },
        case: { select: { status: true, title: true, summary: true } },
      },
    });
    return NextResponse.json({
      ok: true,
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        mode: c.mode,
        updatedAt: c.updatedAt,
        status: c.case?.status ?? "DRAFT",
        messages: c.messages,
      })),
    });
  } catch {
    return NextResponse.json({ ok: true, conversations: [] });
  }
}
