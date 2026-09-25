import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createLoginSession } from "@/lib/modules/auth/session";
import { hasUsableLocalPassword } from "@/lib/modules/auth/password-reset";
import { auditEvent } from "@/lib/modules/audit/audit";
import { recordAuthTelemetry } from "@/lib/modules/auth/auth-telemetry";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(72),
});

const ATTEMPTS = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX = 10;

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
 * POST /api/auth/password-login — دخول بالبريد وكلمة مرور محلية (حسابات الإدارة/التجربة).
 * حسابات OAuth/Clerk بدون كلمة مرور محلية تُرفض برسالة توجّه لـ Google/Apple.
 */
export async function POST(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    recordAuthTelemetry({
      provider: "password",
      outcome: "rate_limited",
      reason: "rate_limited",
      surface: "api",
    });
    return NextResponse.json({ message: "محاولات كثيرة. حاول لاحقًا." }, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    recordAuthTelemetry({
      provider: "password",
      outcome: "failure",
      reason: "invalid_credentials",
      surface: "api",
    });
    return NextResponse.json({ message: "أدخل بريدًا وكلمة مرور صالحين." }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user?.isActive) {
    recordAuthTelemetry({
      provider: "password",
      outcome: "failure",
      reason: "invalid_credentials",
      surface: "sign_in",
    });
    return NextResponse.json({ message: "تعذّر تسجيل الدخول. تحقق من البيانات." }, { status: 401 });
  }

  if (!hasUsableLocalPassword(user.passwordHash)) {
    recordAuthTelemetry({
      provider: "password",
      outcome: "blocked",
      reason: "oauth_only_account",
      surface: "sign_in",
    });
    return NextResponse.json(
      {
        message:
          "هذا الحساب يستخدم تسجيل الدخول عبر Google أو Apple. استخدم الزر أعلاه، أو استعد حسابك من مزوّد الدخول.",
        code: "OAUTH_ONLY",
      },
      { status: 401 }
    );
  }

  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    recordAuthTelemetry({
      provider: "password",
      outcome: "failure",
      reason: "invalid_credentials",
      surface: "sign_in",
    });
    return NextResponse.json({ message: "تعذّر تسجيل الدخول. تحقق من البيانات." }, { status: 401 });
  }

  const safe = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
  await createLoginSession(safe);
  recordAuthTelemetry({
    provider: "password",
    outcome: "success",
    reason: "ok",
    surface: "sign_in",
  });
  await auditEvent({
    actorId: user.id,
    subject: "AUTH",
    action: "LOGIN_SUCCESS",
    metadata: { provider: "password" },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, user: safe, message: "تم تسجيل الدخول." });
}
