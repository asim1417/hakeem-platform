import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { createLoginSession } from "@/lib/modules/auth/session";
import {
  getGoogleOAuthConfig,
  googleCallbackUrl,
  exchangeGoogleCodeForProfile,
  isOAuthAdminEmail,
  GOOGLE_STATE_COOKIE,
  OAUTH_NEXT_COOKIE,
} from "@/lib/modules/auth/google-oauth";

export const dynamic = "force-dynamic";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
}

// GET /api/auth/callback/google — يستقبل رمز Google، يتحقّق من state، يبادله بملف المستخدم،
// ينشئ/يربط المستخدم في القاعدة، ثم يفتح جلسة ويحوّل للوحة التحكم. لا كلمة مرور.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const cfg = getGoogleOAuthConfig();
  if (!cfg) return fail(origin, "google_disabled");

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const cookieState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const nextRaw = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;

  // تنظيف كوكيّات التدفّق دائمًا.
  const store = cookies();
  store.set(GOOGLE_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  store.set(OAUTH_NEXT_COOKIE, "", { maxAge: 0, path: "/" });

  if (params.get("error")) return fail(origin, "google_denied");
  if (!code || !state || !cookieState || state !== cookieState) return fail(origin, "oauth_state");

  const redirectUri = googleCallbackUrl(origin);
  const profile = await exchangeGoogleCodeForProfile(cfg, code, redirectUri);
  const email = (profile?.email || "").toLowerCase().trim();
  if (!profile || !email || profile.email_verified === false) return fail(origin, "google_profile");

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
    // دور الدخول: قائمة الأدمن (OAUTH_ADMIN_EMAILS) أولاً، ثم دور موجود، وإلا:
    // أول مستخدم في القاعدة يُمنح SYSTEM_ADMIN (تمهيد)، وما بعده TRAINEE.
    const bootstrapAdmin = !existing && (await prisma.user.count().catch(() => 1)) === 0;
    const role = isOAuthAdminEmail(email)
      ? "SYSTEM_ADMIN"
      : existing?.role ?? (bootstrapAdmin ? "SYSTEM_ADMIN" : "TRAINEE");

    const user = await prisma.user.upsert({
      where: { email },
      update: { isActive: true, role, ...(profile.name ? { name: profile.name } : {}) },
      create: {
        name: profile.name || email.split("@")[0],
        email,
        // مستخدم OAuth بلا كلمة مرور: قيمة غير صالحة كـ bcrypt فيتعذّر الدخول بكلمة مرور.
        passwordHash: "oauth-google:no-password",
        role,
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    await createLoginSession(user);
    await auditEvent({
      actorId: user.id,
      subject: "AUTH",
      action: "LOGIN_SUCCESS",
      metadata: { email: user.email, role: user.role, provider: "google" },
    }).catch(() => undefined);

    const dest = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/dashboard";
    return NextResponse.redirect(new URL(dest, origin));
  } catch {
    return fail(origin, "oauth_user");
  }
}
