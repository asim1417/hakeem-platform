import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { getPaymentProvider } from "@/lib/payments/payment-provider";
import { encryptPaymentToken } from "@/lib/modules/billing/payment-token";

export const dynamic = "force-dynamic";

/** GET /api/billing/payment-methods — وسائل الدفع الفعّالة (غير الحساسة). */
export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const { prisma } = await import("@/lib/prisma");
  const methods = await prisma.paymentMethod
    .findMany({
      where: { userId: user.id, status: "ACTIVE" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true, brand: true, network: true, lastFour: true, expiryMonth: true, expiryYear: true, isDefault: true },
    })
    .catch(() => []);
  return NextResponse.json({ methods });
}

/**
 * POST /api/billing/payment-methods — حفظ وسيلة مرمّزة (بموافقة المستخدم).
 * body: { providerToken, brand?, lastFour?, expiryMonth?, expiryYear? }
 * لا نخزّن PAN/CVC — التوكن فقط، مشفّرًا (AES-256-GCM).
 */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as {
    providerToken?: string;
    brand?: string;
    network?: string;
    lastFour?: string;
    expiryMonth?: number;
    expiryYear?: number;
  };
  if (!body.providerToken) return NextResponse.json({ message: "توكن الدفع مطلوب." }, { status: 400 });

  const provider = await getPaymentProvider();
  const tok = await provider.tokenizePaymentMethod({ userId: user.id, providerToken: body.providerToken });
  if (!tok.ok || !tok.providerToken) {
    return NextResponse.json({ message: tok.message || "تعذّر حفظ وسيلة الدفع." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/prisma");
  const existingCount = await prisma.paymentMethod.count({ where: { userId: user.id, status: "ACTIVE" } });
  const pm = await prisma.paymentMethod.create({
    data: {
      userId: user.id,
      provider: provider.name,
      providerCustomerId: tok.providerCustomerId ?? null,
      providerToken: encryptPaymentToken(tok.providerToken),
      brand: body.brand ?? tok.brand ?? null,
      network: body.network ?? null,
      lastFour: (body.lastFour ?? tok.lastFour ?? "").slice(0, 4) || null,
      expiryMonth: body.expiryMonth ?? tok.expiryMonth ?? null,
      expiryYear: body.expiryYear ?? tok.expiryYear ?? null,
      isDefault: existingCount === 0, // أول وسيلة = افتراضية.
      status: "ACTIVE",
    },
    select: { id: true, brand: true, lastFour: true, isDefault: true },
  });
  return NextResponse.json({ ok: true, paymentMethod: pm });
}
