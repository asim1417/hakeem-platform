import { NextRequest, NextResponse } from "next/server";
import { activateSubscription } from "@/lib/modules/billing/moyasar";
import {
  recordBillingEvent,
  verifyMoyasarWebhookSecret,
} from "@/lib/modules/billing/billing-events";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
import { recordReferralFirstPurchase } from "@/lib/modules/referrals/usage-referrals";
import { enforceRateLimit, rateLimitKeyFromRequest } from "@/lib/modules/billing/rate-limit";

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
  const rl = await enforceRateLimit(rateLimitKeyFromRequest("wh-legacy", null, request), 240, 60);
  if (!rl.allowed) return NextResponse.json({ ok: false, message: "rate limited" }, { status: 429 });
  await hydrateEnvFromSettings().catch(() => 0);

  let body: MoyasarBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "invalid json" }, { status: 400 });
  }

  const secretCheck = verifyMoyasarWebhookSecret(body);
  if (!secretCheck.ok) {
    return NextResponse.json(
      { ok: false, message: "webhook secret rejected", reason: secretCheck.reason },
      { status: 401 }
    );
  }
  // Fail-closed: لا نقبل webhook غير موقّع في الإنتاج / عند تفعيل الفوترة (منع تزوير الاشتراك).
  const billingLive =
    process.env.NODE_ENV === "production" ||
    /^(1|true|on)$/i.test(process.env.BILLING_ENABLED || "");
  if (billingLive && !secretCheck.enforced) {
    return NextResponse.json(
      { ok: false, message: "webhook secret required" },
      { status: 401 }
    );
  }

  const status = body.status || body.data?.status || "";
  const userId = body.metadata?.userId || body.data?.metadata?.userId || null;
  const planId = body.metadata?.planId || body.data?.metadata?.planId || null;
  const interval = body.metadata?.interval || body.data?.metadata?.interval || null;
  const amount = body.amount ?? body.data?.amount ?? null;
  const currency = body.currency || body.data?.currency || null;
  const paymentId = body.data?.id || body.id || "";
  const eventId = paymentId || `moyasar_${Date.now()}`;
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

  // إعادة التحقق من البوابة قبل التفعيل — لا نثق بجسم الـwebhook (مصدر الحقيقة).
  let gatewayConfirmedPaid = paid;
  try {
    const { getPaymentProvider } = await import("@/lib/payments/payment-provider");
    const provider = await getPaymentProvider();
    if (provider.isLive() && paymentId) {
      const verified = await provider.verifyPayment(paymentId);
      gatewayConfirmedPaid = verified?.status === "paid";
    }
  } catch {
    // تعذّر التحقق من البوابة — لا نُفعّل بناءً على الجسم وحده إن كانت البوابة حيّة.
  }

  // فعّل الاشتراك فقط عند حدث جديد مدفوع ومؤكَّد من البوابة (لا تفعيل عند فشل التسجيل).
  if (gatewayConfirmedPaid && userId && recorded.inserted) {
    await activateSubscription(userId);
    await recordReferralFirstPurchase(userId, eventId).catch(() => false);
  }

  return NextResponse.json({
    ok: true,
    received: true,
    paid: gatewayConfirmedPaid,
    userId: userId || null,
    eventId,
    recorded: recorded.ok,
    inserted: recorded.inserted,
    secretEnforced: secretCheck.enforced,
  });
}
