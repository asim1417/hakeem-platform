import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { changePlan } from "@/lib/modules/billing/subscriptions";

export const dynamic = "force-dynamic";

/** POST /api/billing/subscription/change-plan — ترقية فورية / تخفيض للدورة التالية. */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    planCode?: string;
    period?: "MONTHLY" | "YEARLY";
  };
  if (!body.planCode || (body.period !== "MONTHLY" && body.period !== "YEARLY")) {
    return NextResponse.json({ message: "بيانات الباقة ناقصة." }, { status: 400 });
  }
  const result = await changePlan({
    userId: user.id,
    newPlanCode: body.planCode,
    period: body.period,
    origin: new URL(request.url).origin,
    userEmail: user.email,
    userName: user.name,
  });
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ ok: true, mode: result.mode, url: result.url, message: result.message });
}
