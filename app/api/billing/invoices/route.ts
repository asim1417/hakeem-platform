import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/** GET /api/billing/invoices — فواتير المستخدم. */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) {
    return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  }
  const { prisma } = await import("@/lib/prisma");
  const invoices = await prisma.invoice
    .findMany({
      where: { userId: user.id },
      orderBy: { issuedAt: "desc" },
      take: 100,
      select: {
        id: true,
        invoiceNumber: true,
        type: true,
        status: true,
        currency: true,
        subtotalHalalas: true,
        vatHalalas: true,
        totalHalalas: true,
        issuedAt: true,
        pdfUrl: true,
        zatcaStatus: true,
      },
    })
    .catch(() => []);
  return NextResponse.json({ invoices });
}
