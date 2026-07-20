import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { PLANS, PRICING, isCheckoutLive } from "@/config/pricing";

export const dynamic = "force-dynamic";

/** GET /api/billing/status — حالة الحصّة والخطة للواجهة. */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  const status = await getStatus(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    quota: status,
    pricing: { freeQuota: PRICING.freeQuota, warnAt: PRICING.warnAt, currency: PRICING.currency },
    plans: PLANS.map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      monthlySar: p.monthlySar,
      yearlySar: p.yearlySar,
      checkoutEnabled: p.checkoutEnabled,
    })),
    checkoutLive: isCheckoutLive(),
  });
}
