import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completePasswordReset } from "@/lib/modules/auth/password-reset";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20).max(2000),
  password: z.string().min(8).max(72),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const result = await completePasswordReset({
    token: body.token,
    newPassword: body.password,
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    message: "تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.",
  });
}
