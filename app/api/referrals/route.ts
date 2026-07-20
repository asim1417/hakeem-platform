import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getReferralInfo, redeemReferral } from "@/lib/modules/referrals/codes";

export const dynamic = "force-dynamic";

const redeemSchema = z.object({
  referralCode: z.string().min(4).max(32),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const origin = request.nextUrl.origin;
  const info = await getReferralInfo(user.id, origin);
  return NextResponse.json(info);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  let body: z.infer<typeof redeemSchema>;
  try {
    body = redeemSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "رمز الإحالة غير صالح." }, { status: 400 });
  }

  const result = await redeemReferral(user.id, body.referralCode);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
