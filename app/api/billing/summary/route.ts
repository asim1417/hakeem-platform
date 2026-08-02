import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getWalletSummary } from "@/lib/modules/billing/credit-engine";

export const dynamic = "force-dynamic";

/** GET /api/billing/summary — ملخّص محفظة النقاط للواجهة. */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  const summary = await getWalletSummary(user.id);
  return NextResponse.json({ summary });
}
