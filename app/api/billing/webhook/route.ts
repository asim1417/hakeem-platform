import { NextRequest, NextResponse } from "next/server";
import { activateSubscription } from "@/lib/modules/billing/moyasar";

export const dynamic = "force-dynamic";

/**
 * Webhook Moyasar — يفعّل الاشتراك عند paid/captured.
 * التحقق الكامل من التوقيع يُضاف عند ضبط MOYASAR_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  let body: {
    id?: string;
    status?: string;
    metadata?: { userId?: string };
    data?: { status?: string; metadata?: { userId?: string } };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }

  const status = body.status || body.data?.status || "";
  const userId = body.metadata?.userId || body.data?.metadata?.userId;
  const paid = ["paid", "captured", "verified"].includes(status.toLowerCase());

  if (paid && userId) {
    await activateSubscription(userId);
  }

  return NextResponse.json({ ok: true, received: true, paid, userId: userId || null });
}
