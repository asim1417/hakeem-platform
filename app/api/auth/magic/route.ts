import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ensurePlatformOwner } from "@/lib/modules/auth/ensure-owner";
import { canRequestMagicLink, issueMagicToken } from "@/lib/modules/auth/magic-link";
import { isEmailConfigured, sendEmail } from "@/lib/modules/email/send";
import { safeNextPath } from "@/lib/modules/auth/oauth-shared";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

/**
 * POST /api/auth/magic — يطلب رابط دخول للمالك فقط عبر البريد.
 * إن لم يُضبط Resend يُعاد الرابط في الاستجابة ليُفتح مباشرة (مناسب أثناء الإعداد).
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "أدخل بريدًا صالحًا." }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  if (!canRequestMagicLink(email)) {
    return NextResponse.json(
      { message: "الدخول بالرابط السحري متاح لحساب المالك فقط حاليًا." },
      { status: 403 }
    );
  }

  await ensurePlatformOwner().catch(() => undefined);

  const next = safeNextPath(body.next, "/dashboard");
  const { token, exp } = issueMagicToken(email);
  const origin = request.nextUrl.origin;
  const magicUrl = `${origin}/api/auth/magic/consume?token=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`;

  let emailed = false;
  if (isEmailConfigured()) {
    const result = await sendEmail({
      to: email,
      subject: "رابط دخول حكيم — المالك",
      html: `
        <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.8;color:#0E3435">
          <h1 style="color:#0E3435">حكيم</h1>
          <p>اضغط الرابط للدخول كمالك (صالح 15 دقيقة):</p>
          <p><a href="${magicUrl}" style="color:#C69763">${magicUrl}</a></p>
        </div>
      `,
      text: `رابط الدخول: ${magicUrl}`,
    });
    emailed = result.ok && !result.skipped;
  }

  return NextResponse.json({
    ok: true,
    emailed,
    expiresAt: exp,
    // يُعرض الرابط إن لم يُرسل البريد — حتى يكتمل إعداد Resend.
    magicUrl: emailed ? undefined : magicUrl,
    message: emailed
      ? "أُرسل رابط الدخول إلى بريدك. افتح الرسالة خلال 15 دقيقة."
      : "البريد غير مهيّأ بعد — افتح الرابط مباشرة للدخول كمالك.",
  });
}
