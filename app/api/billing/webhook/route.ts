import { NextRequest, NextResponse } from "next/server";
import { paymentsEnabled } from "@/lib/modules/billing/moyasar";
import { prisma } from "@/lib/prisma";
import {
  recordBillingEvent,
  verifyMoyasarWebhookSecret,
} from "@/lib/modules/billing/billing-events";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
export const dynamic = "force-dynamic";

type MoyasarBody = {
  id?: string;
  type?: string;
  status?: string;
  amount?: number;
  currency?: string;
  secret_token?: string;
  secret?: string;
  metadata?: {
    userId?: string;
    planId?: string;
    interval?: string;
  };
  data?: {
    id?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: {
      userId?: string;
      planId?: string;
      interval?: string;
    };
  };
};

/**
 * Webhook Moyasar — يسجّل الحدث ويُفعّل الاشتراك عند paid/captured.
 * التحقق من السر ناعم: إن وُجد MOYASAR_WEBHOOK_SECRET يُرفض غير المطابق؛ وإلا يبقى متوافقًا.
 */
export async function POST(request: NextRequest) {
  await hydrateEnvFromSettings().catch(() => 0);

  let body: MoyasarBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }

  if (!paymentsEnabled()) {
    return NextResponse.json({ ok: true, payments: "غير مهيأة" });
  }

  const secretCheck = verifyMoyasarWebhookSecret(body);
  if (!secretCheck.ok) {
    return NextResponse.json(
      { ok: false, message: "webhook secret rejected", reason: secretCheck.reason },
      { status: 401 }
    );
  }

  const status = body.status || body.data?.status || "";
  const userId = body.metadata?.userId || body.data?.metadata?.userId || null;
  const planId = body.metadata?.planId || body.data?.metadata?.planId || null;
  const interval = body.metadata?.interval || body.data?.metadata?.interval || null;
  const amount = body.amount ?? body.data?.amount ?? null;
  const currency = body.currency || body.data?.currency || null;
  const eventId = body.id || body.data?.id || `moyasar_${Date.now()}`;
  const paid = ["paid", "captured", "verified"].includes(status.toLowerCase());

  const recorded = await recordBillingEvent({
    id: eventId,
    provider: "moyasar",
    eventType: body.type || "payment",
    status,
    userId,
    planId,
    interval,
    amount: typeof amount === "number" ? amount : null,
    currency,
    payload: body as Record<string, unknown>,
  });

  // التفعيل سجل إضافة فقط. لا يُحدَّث users.subscriptionStatus من هذا المسار.
  if (paid && userId && recorded.inserted) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO subscription_activation (id, user_id, event_id, plan_id)
       VALUES (gen_random_uuid()::text, $1, $2, $3)
       ON CONFLICT (event_id) DO NOTHING`,
      userId,
      eventId,
      planId,
    ).catch(() => 0);
  }

  return NextResponse.json({
    ok: true,
    received: true,
    paid,
    userId: userId || null,
    eventId,
    recorded: recorded.ok,
    inserted: recorded.inserted,
    secretEnforced: secretCheck.enforced,
  });
}
