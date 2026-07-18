import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getGoogleOAuthConfig,
  googleCallbackUrl,
  exchangeGoogleCodeForProfile,
  GOOGLE_STATE_COOKIE,
  OAUTH_NEXT_COOKIE,
} from "@/lib/modules/auth/google-oauth";
import { isOAuthAdminEmail, OAUTH_REF_COOKIE, safeNextPath } from "@/lib/modules/auth/oauth-shared";
import { provisionOAuthUser } from "@/lib/modules/auth/oauth-user";

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
  const refRaw = request.cookies.get(OAUTH_REF_COOKIE)?.value;

  // تنظيف كوكيّات التدفّق دائمًا.
  const store = cookies();
  store.set(GOOGLE_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  store.set(OAUTH_NEXT_COOKIE, "", { maxAge: 0, path: "/" });
  store.set(OAUTH_REF_COOKIE, "", { maxAge: 0, path: "/" });

  if (params.get("error")) return fail(origin, "google_denied");
  if (!code || !state || !cookieState || state !== cookieState) return fail(origin, "oauth_state");

  const redirectUri = googleCallbackUrl(origin);
  const profile = await exchangeGoogleCodeForProfile(cfg, code, redirectUri);
  const email = (profile?.email || "").toLowerCase().trim();
  if (!profile || !email || profile.email_verified === false) return fail(origin, "google_profile");

  try {
    const user = await provisionOAuthUser({
      email,
      name: profile.name,
      provider: "google",
      referralCode: refRaw,
    });
    const dest =
      user.isNew && !isOAuthAdminEmail(email)
        ? "/onboarding"
        : safeNextPath(nextRaw);
    return NextResponse.redirect(new URL(dest, origin));
  } catch {
    return fail(origin, "oauth_user");
  }
}
