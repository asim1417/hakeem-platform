import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  ensurePlatformOwner,
  OWNER_DEFAULT_EMAIL,
  OWNER_DEFAULT_PASSWORD,
} from "@/lib/modules/auth/ensure-owner";
import { createLoginSession } from "@/lib/modules/auth/session";
import { isOAuthAdminEmail } from "@/lib/modules/auth/oauth-shared";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

/**
 * POST /api/auth/owner-login — دخول طوارئ للمالك فقط (قبل/بدون Clerk).
 * البريد يجب أن يكون في PLATFORM_OWNER_EMAILS.
 */
export async function POST(request: NextRequest) {
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "بيانات غير صالحة." }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  if (!isOAuthAdminEmail(email)) {
    return NextResponse.json({ message: "هذا المسار مخصّص لمالك المنصة فقط." }, { status: 403 });
  }

  await ensurePlatformOwner().catch(() => undefined);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user?.isActive) {
    return NextResponse.json({ message: "حساب المالك غير متاح." }, { status: 401 });
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  // قبول كلمة المرور الافتراضية حتى لو تغيّر الهاش في DB بعد ensure
  const fallback =
    !ok &&
    body.password === (process.env.OWNER_BOOTSTRAP_PASSWORD || OWNER_DEFAULT_PASSWORD).trim();
  if (!ok && !fallback) {
    return NextResponse.json({ message: "كلمة المرور غير صحيحة." }, { status: 401 });
  }

  if (fallback && !ok) {
    // أعد ضبط الهاش ليطابق كلمة المرور المعروفة
    await ensurePlatformOwner().catch(() => undefined);
  }

  const safe = { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive };
  await createLoginSession(safe);
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { email, provider: "owner_emergency", asOwner: true },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    user: safe,
    message: "تم دخول المالك.",
    hint: email === OWNER_DEFAULT_EMAIL ? "بعد ضبط Clerk استخدم /sign-in كالمعتاد." : undefined,
  });
}
