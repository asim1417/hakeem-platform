import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/modules/auth/password-reset";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
});

const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX = 8;

function limited(key: string) {
  const now = Date.now();
  const rec = ATTEMPTS.get(key);
  if (!rec || now > rec.resetAt) {
    ATTEMPTS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX;
}

/**
 * POST /api/auth/forgot-password
 * رسالة موحّدة دائمًا — لا تسرّب وجود الحساب.
 */
export async function POST(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ message: "محاولات كثيرة. حاول لاحقًا." }, { status: 429 });
  }

  let email: string;
  try {
    email = schema.parse(await request.json()).email;
  } catch {
    return NextResponse.json({ message: "أدخل بريدًا إلكترونيًا صالحًا." }, { status: 400 });
  }

  const result = await requestPasswordReset(email).catch(
    (): { ok: true; emailed: boolean; resetUrl?: string } => ({
      ok: true,
      emailed: false,
    })
  );

  return NextResponse.json({
    ok: true,
    message:
      "إن وُجد حساب بكلمة مرور محلية مرتبط بهذا البريد، فصلك رابط لإعادة التعيين خلال دقائق.",
    emailed: result.emailed,
    ...(result.resetUrl ? { resetUrl: result.resetUrl } : {}),
  });
}
