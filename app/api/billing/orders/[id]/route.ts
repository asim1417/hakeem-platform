import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getOrder } from "@/lib/modules/billing/orders";

export const dynamic = "force-dynamic";

/** GET /api/billing/orders/[id] — حالة طلب (لصاحبه فقط). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  const order = await getOrder(params.id);
  if (!order || order.userId !== user.id) {
    return NextResponse.json({ message: "الطلب غير موجود." }, { status: 404 });
  }
  return NextResponse.json({
    order: {
      id: order.id,
      type: order.type,
      status: order.status,
      currency: order.currency,
      totalHalalas: order.totalHalalas,
      pointsGranted: order.pointsGranted,
    },
  });
}
