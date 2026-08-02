import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { startCheckout, paidCheckoutEnabled } from "@/lib/modules/billing/checkout";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/checkout/start — بدء دفع اشتراك/حزمة (§8) — منظومة النقاط الجديدة.
 * body: { type: 'SUBSCRIPTION'|'PACKAGE', planCode?, period?, packageCode? }
 * المبالغ خادمية بالكامل. المسار القديم /api/billing/checkout يبقى للتوافق.
 */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  if (!paidCheckoutEnabled()) {
    return NextResponse.json({ message: "الدفع غير مفعّل حاليًا." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    type?: "SUBSCRIPTION" | "PACKAGE";
    planCode?: string;
    period?: "MONTHLY" | "YEARLY";
    packageCode?: string;
  };
  if (body.type !== "SUBSCRIPTION" && body.type !== "PACKAGE") {
    return NextResponse.json({ message: "نوع الطلب غير صالح." }, { status: 400 });
  }
  const origin = new URL(request.url).origin;
  const result = await startCheckout({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    origin,
    type: body.type,
    planCode: body.planCode,
    period: body.period,
    packageCode: body.packageCode,
  });
  if (!result.ok) {
    return NextResponse.json({ message: result.message || "تعذّر بدء الدفع." }, { status: 400 });
  }
  return NextResponse.json({ url: result.url, orderId: result.orderId });
}
