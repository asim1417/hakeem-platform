import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/billing — مهمة الفوترة الدورية (Vercel Cron).
 * المصالحة + التجديد + انتهاء الأرصدة. محميّة بـ CRON_SECRET (Bearer).
 * تُجدوَل في vercel.json. تعالج فجوة «لا cron مربوط» (§18).
 */
export async function GET(request: NextRequest) {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const { ensureBillingSchema } = await import("@/lib/modules/billing/ensure-billing-schema");
    await ensureBillingSchema();
    const [{ runReconciliation }, { runRenewals }] = await Promise.all([
      import("@/lib/modules/billing/reconciliation"),
      import("@/lib/modules/billing/renewal"),
    ]);
    const now = new Date();
    const recon = await runReconciliation(now);
    const renew = await runRenewals(now);
    return NextResponse.json({ ok: true, recon, renew, at: now.toISOString() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error)?.message }, { status: 500 });
  }
}
