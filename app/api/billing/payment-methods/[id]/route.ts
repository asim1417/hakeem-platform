import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/** DELETE /api/billing/payment-methods/[id] — إزالة وسيلة دفع (حق الحذف، §14). */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const { prisma } = await import("@/lib/prisma");
  const pm = await prisma.paymentMethod.findFirst({ where: { id: params.id, userId: user.id } });
  if (!pm) return NextResponse.json({ message: "وسيلة الدفع غير موجودة." }, { status: 404 });

  // لا نحتفظ بأي بيانات بطاقة خام؛ نُبطل التوكن ونعلّم الحالة REMOVED.
  await prisma.paymentMethod.update({
    where: { id: pm.id },
    data: { status: "REMOVED", isDefault: false, providerToken: null },
  });
  return NextResponse.json({ ok: true });
}

/** GET /api/billing/payment-methods/[id] — تفاصيل وسيلة (غير الحساسة). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const { prisma } = await import("@/lib/prisma");
  const pm = await prisma.paymentMethod.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, brand: true, lastFour: true, expiryMonth: true, expiryYear: true, isDefault: true, status: true },
  });
  if (!pm) return NextResponse.json({ message: "وسيلة الدفع غير موجودة." }, { status: 404 });
  return NextResponse.json({ paymentMethod: pm });
}
