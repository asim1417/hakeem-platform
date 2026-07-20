import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getPlan, isCheckoutLive, type PlanId, type PlanInterval } from "@/config/pricing";

export const dynamic = "force-dynamic";

/**
 * POST/GET /api/billing/checkout — جاهز لربط Moyasar لاحقًا.
 * حاليًا يعيد 503 مع رسالة واضحة دون كسر الواجهة.
 */
export async function GET(request: NextRequest) {
  return checkout(request);
}

export async function POST(request: NextRequest) {
  return checkout(request);
}

async function checkout(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }

  const planId = (request.nextUrl.searchParams.get("plan") || "pro") as PlanId;
  const interval = (request.nextUrl.searchParams.get("interval") || "monthly") as PlanInterval;
  const plan = getPlan(planId);

  if (!plan || plan.id === "free") {
    return NextResponse.redirect(new URL("/dashboard/subscribe", request.url));
  }

  if (!isCheckoutLive() || !plan.checkoutEnabled) {
    // واجهة ودّية: إعادة توجيه لصفحة الخطط مع تنبيه.
    const url = new URL("/dashboard/subscribe", request.url);
    url.searchParams.set("checkout", "pending");
    return NextResponse.redirect(url);
  }

  // مكان ربط Moyasar لاحقًا: إنشاء فاتورة/جلسة دفع وإعادة التوجيه.
  return NextResponse.json(
    {
      message: "بوابة الدفع غير مفعّلة بعد — اضبط مفاتيح Moyasar وفعّل checkoutEnabled للخطة.",
      plan: plan.id,
      interval,
      userId: user.id,
    },
    { status: 503 }
  );
}
