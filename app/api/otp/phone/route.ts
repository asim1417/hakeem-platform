import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { issuePhoneOtp, verifyPhoneOtp } from "@/lib/modules/otp/phone-otp";

export const dynamic = "force-dynamic";

const issueSchema = z.object({
  action: z.literal("issue"),
  phone: z.string().min(9).max(32),
});

const verifySchema = z.object({
  action: z.literal("verify"),
  code: z.string().min(4).max(8),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });

  const raw = await request.json().catch(() => null);
  const action = raw?.action;

  if (action === "issue") {
    const parsed = issueSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ message: "رقم الجوال مطلوب." }, { status: 400 });
    }
    const result = await issuePhoneOtp(user.id, parsed.data.phone);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "verify") {
    const parsed = verifySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ message: "رمز غير صالح." }, { status: 400 });
    }
    const result = await verifyPhoneOtp(user.id, parsed.data.code);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  return NextResponse.json({ message: "action غير معروف." }, { status: 400 });
}
