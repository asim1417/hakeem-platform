import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/** POST /api/billing/payment-methods/default — تعيين وسيلة دفع افتراضية. */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ message: "id مطلوب." }, { status: 400 });

  const { prisma } = await import("@/lib/prisma");
  const pm = await prisma.paymentMethod.findFirst({ where: { id: body.id, userId: user.id, status: "ACTIVE" } });
  if (!pm) return NextResponse.json({ message: "وسيلة الدفع غير موجودة." }, { status: 404 });

  await prisma.$transaction([
    prisma.paymentMethod.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    prisma.paymentMethod.update({ where: { id: pm.id }, data: { isDefault: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
