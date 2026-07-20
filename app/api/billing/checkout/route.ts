import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getPlan, isCheckoutLive, type PlanId, type PlanInterval } from "@/config/pricing";
import { createMoyasarInvoice } from "@/lib/modules/billing/moyasar";

export const dynamic = "force-dynamic";

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

  if (!isCheckoutLive()) {
    const url = new URL("/dashboard/subscribe", request.url);
    url.searchParams.set("checkout", "pending");
    return NextResponse.redirect(url);
  }

  const result = await createMoyasarInvoice({
    plan,
    interval,
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    origin: request.nextUrl.origin,
  });

  if (!result.ok) {
    const url = new URL("/dashboard/subscribe", request.url);
    url.searchParams.set("checkout", "error");
    url.searchParams.set("msg", result.message.slice(0, 120));
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(result.invoice.url);
}
