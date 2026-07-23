import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCodeForProfile,
  getGoogleOAuthConfig,
  googleCallbackUrl,
  GOOGLE_STATE_COOKIE,
  OAUTH_NEXT_COOKIE,
} from "@/lib/modules/auth/google-oauth";
import { OAUTH_REF_COOKIE, safeNextPath } from "@/lib/modules/auth/oauth-shared";
import { establishFirstPartySession } from "@/lib/modules/auth/establish-session";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
import { continueUrl } from "@/lib/modules/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/callback/google
 * بعد Google: تثبيت hakeem_session (+ مزامنة Clerk Backend) ثم التوجيه.
 */
export async function GET(request: NextRequest) {
  await hydrateEnvFromSettings().catch(() => 0);

  const cfg = getGoogleOAuthConfig();
  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/sign-in?login_error=${encodeURIComponent(reason)}`, request.url)
    );

  if (!cfg) return fail("google_not_configured");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const nextRaw = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  const ref = request.cookies.get(OAUTH_REF_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return fail("invalid_oauth_state");
  }

  const profile = await exchangeGoogleCodeForProfile(
    cfg,
    code,
    googleCallbackUrl(request.nextUrl.origin)
  );
  if (!profile?.email) return fail("google_profile_failed");

  try {
    await establishFirstPartySession({
      email: profile.email,
      name: profile.name,
      referralCode: ref,
      provider: "google",
    });
  } catch {
    return fail("session_establish_failed");
  }

  const next = safeNextPath(nextRaw, "/dashboard");
  const res = NextResponse.redirect(new URL(continueUrl(next), request.url));
  res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(OAUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(OAUTH_REF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
