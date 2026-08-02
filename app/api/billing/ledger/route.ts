import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getUsageCreditStatus } from "@/lib/modules/credits/usage-ledger";
import { milliToPoints } from "@/lib/modules/credits/points";

export const dynamic = "force-dynamic";

/** GET /api/billing/ledger — سجل حركات النقاط (بالنقاط). */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  const limit = Math.min(200, Math.max(1, Number(new URL(request.url).searchParams.get("limit")) || 100));
  const status = await getUsageCreditStatus(user.id, limit);
  return NextResponse.json({
    enabled: status.enabled,
    balancePoints: milliToPoints(status.balanceMilliUnits),
    reservedPoints: milliToPoints(status.reservedMilliUnits),
    availablePoints: milliToPoints(status.availableMilliUnits),
    entries: status.ledger.map((e) => ({
      id: e.id,
      points: milliToPoints(e.amountMilliUnits),
      balanceAfterPoints: milliToPoints(e.balanceAfterMilliUnits),
      source: e.source,
      description: e.description,
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      createdAt: e.createdAt,
    })),
  });
}
