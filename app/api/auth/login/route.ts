import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "صيغة بيانات الدخول غير صالحة." }, { status: 400 });
  }

  const email = payload.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, passwordHash: true, isActive: true },
  });

  // رفض قيم OAuth الوهمية ككلمة مرور.
  const hash = user?.passwordHash ?? "";
  const isOAuthOnly = hash.startsWith("oauth-") || hash === "not-for-login";
  const passwordOk =
    user && !isOAuthOnly && hash
      ? await bcrypt.compare(payload.password, hash).catch(() => false)
      : false;

  if (!user || !user.isActive || !passwordOk) {
    await auditEvent({
      actorId: user?.id,
      subject: "AUTH",
      action: "LOGIN_FAILED",
      metadata: {
        email,
        reason: !user ? "USER_NOT_FOUND" : !user.isActive ? "USER_INACTIVE" : isOAuthOnly ? "OAUTH_ONLY" : "BAD_PASSWORD",
      },
    }).catch(() => undefined);
    return NextResponse.json(
      {
        message:
          user?.isActive && isOAuthOnly
            ? "هذا الحساب مرتبط ببوابة دخول خارجية — استخدم Google أو Microsoft."
            : "بيانات الدخول غير صحيحة أو أن المستخدم غير نشط.",
      },
      { status: 401 }
    );
  }

  await createLoginSession(user);
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { email: user.email, role: user.role, provider: "password" },
  });
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
