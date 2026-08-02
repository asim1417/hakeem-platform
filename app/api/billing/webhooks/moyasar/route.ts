import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook } from "@/lib/modules/billing/webhook-processor";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
import { enforceRateLimit, rateLimitKeyFromRequest } from "@/lib/modules/billing/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/webhooks/moyasar — webhook مُقوّى (§7).
 * تحقق توقيع → تسجيل خام → منع تكرار → إعادة تحقق من البوابة → مطابقة مبلغ → إيفاء idempotent.
 */
export async function POST(request: NextRequest) {
  const rl = await enforceRateLimit(rateLimitKeyFromRequest("wh-moyasar", null, request), 240, 60);
  if (!rl.allowed) return NextResponse.json({ status: "rate_limited" }, { status: 429 });
  await hydrateEnvFromSettings().catch(() => 0);
  const rawBody = await request.text();
  const headers: Record<string, string | undefined> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  try {
    const outcome = await processPaymentWebhook(rawBody, headers);
    return NextResponse.json({ status: outcome.status, detail: outcome.detail }, { status: outcome.http });
  } catch {
    // نُعيد 200 لتفادي إعادة إرسال لا نهائية؛ المصالحة اليومية تلتقط ما فات.
    return NextResponse.json({ status: "error" }, { status: 200 });
  }
}
