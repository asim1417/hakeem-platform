import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getMicrosoftOAuthConfig,
  microsoftCallbackUrl,
  exchangeMicrosoftCodeForProfile,
  MICROSOFT_STATE_COOKIE,
} from "@/lib/modules/auth/microsoft-oauth";
import { isOAuthAdminEmail, OAUTH_NEXT_COOKIE, OAUTH_REF_COOKIE, safeNextPath } from "@/lib/modules/auth/oauth-shared";
import { provisionOAuthUser } from "@/lib/modules/auth/oauth-user";

export const dynamic = "force-dynamic";

function fail(origin: string, reason: string) {
  return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
}

// GET /api/auth/callback/microsoft — يستقبل رمز Entra، يتحقّق من state، يبادله بملف المستخدم،
// ينشئ/يربط المستخدم، ثم يفتح جلسة ويحوّل للوجهة.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const cfg = getMicrosoftOAuthConfig();
  if (!cfg) return fail(origin, "microsoft_disabled");

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const cookieState = request.cookies.get(MICROSOFT_STATE_COOKIE)?.value;
  const nextRaw = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  const refRaw = request.cookies.get(OAUTH_REF_COOKIE)?.value;

  const store = cookies();
  store.set(MICROSOFT_STATE_COOKIE, "", { maxAge: 0, path: "/" });
  store.set(OAUTH_NEXT_COOKIE, "", { maxAge: 0, path: "/" });
  store.set(OAUTH_REF_COOKIE, "", { maxAge: 0, path: "/" });

  if (params.get("error")) return fail(origin, "microsoft_denied");
  if (!code || !state || !cookieState || state !== cookieState) return fail(origin, "oauth_state");

  const redirectUri = microsoftCallbackUrl(origin);
  const profile = await exchangeMicrosoftCodeForProfile(cfg, code, redirectUri);
  const email = (profile?.email || "").toLowerCase().trim();
  if (!profile || !email) return fail(origin, "microsoft_profile");

  // رفض UPN غير البريدي (مثل user@tenant.onmicrosoft.com مقبول؛ بدون @ مرفوض).
  if (!email.includes("@")) return fail(origin, "microsoft_profile");

  try {
    const user = await provisionOAuthUser({
      email,
      name: profile.name,
      provider: "microsoft",
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
