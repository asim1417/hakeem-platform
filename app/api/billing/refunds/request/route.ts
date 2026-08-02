import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";
import { enforceRateLimit } from "@/lib/modules/billing/rate-limit";

export const dynamic = "force-dynamic";

/** POST /api/billing/refunds/request — طلب استرداد (يُراجَع إداريًا، لا تنفيذ فوري). */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const rl = await enforceRateLimit(`refund-req:u:${user.id}`, 5, 3600);
  if (!rl.allowed) return NextResponse.json({ message: "طلبات استرداد كثيرة. حاول لاحقًا." }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { paymentId?: string; reason?: string };
  if (!body.paymentId) return NextResponse.json({ message: "paymentId مطلوب." }, { status: 400 });

  const { prisma } = await import("@/lib/prisma");
  // التأكد أن الدفعة تخصّ المستخدم عبر الطلب.
  const payment = await prisma.payment.findFirst({
    where: { id: body.paymentId, order: { userId: user.id } },
  });
  if (!payment) return NextResponse.json({ message: "الدفعة غير موجودة." }, { status: 404 });
  if (payment.status !== "PAID") {
    return NextResponse.json({ message: "لا يمكن استرداد دفعة غير مدفوعة." }, { status: 400 });
  }

  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      amountHalalas: payment.amountHalalas,
      reason: (body.reason || "").slice(0, 500) || "طلب مستخدم",
      status: "PENDING",
    },
  });
  await recordBillingAudit({
    action: "REFUND_REQUESTED",
    actorUserId: user.id,
    targetType: "payment",
    targetId: payment.id,
    reason: body.reason,
    metadata: { refundId: refund.id, amountHalalas: payment.amountHalalas },
  });
  return NextResponse.json({ ok: true, refundId: refund.id, status: "PENDING" });
}
