import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { estimateServiceCost, getAvailableBalance, type DocumentTier } from "@/lib/modules/billing/credit-engine";

export const dynamic = "force-dynamic";

const TIERS: DocumentTier[] = ["small", "medium", "large", "xlarge"];

/**
 * POST /api/billing/estimate — تقدير تكلفة خدمة بالنقاط قبل التشغيل (§10).
 * السعر يُحسب خادميًا فقط؛ لا يقبل serviceCode/points من العميل كسعر.
 */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    serviceCode?: string;
    quantity?: number;
    opus?: boolean;
    proExport?: boolean;
    documentTier?: string;
  };
  if (!body.serviceCode) {
    return NextResponse.json({ message: "serviceCode مطلوب." }, { status: 400 });
  }
  const documentTier = TIERS.includes(body.documentTier as DocumentTier)
    ? (body.documentTier as DocumentTier)
    : undefined;

  const [estimate, available] = await Promise.all([
    estimateServiceCost(body.serviceCode, {
      quantity: body.quantity,
      opus: Boolean(body.opus),
      proExport: Boolean(body.proExport),
      documentTier,
    }),
    getAvailableBalance(user.id),
  ]);

  return NextResponse.json({
    serviceCode: estimate.serviceCode,
    costPoints: estimate.points,
    breakdown: estimate.breakdown,
    requiresApproval: estimate.requiresApproval,
    balancePoints: available,
    balanceAfterPoints: available - estimate.points,
    sufficient: available >= estimate.points,
  });
}
