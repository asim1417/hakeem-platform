import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  getGoogleOAuthConfig,
  googleCallbackUrl,
  GOOGLE_POPUP_COOKIE,
  GOOGLE_STATE_COOKIE,
  newOAuthState,
  OAUTH_NEXT_COOKIE,
} from "@/lib/modules/auth/google-oauth";
import { OAUTH_REF_COOKIE, safeNextPath } from "@/lib/modules/auth/oauth-shared";
import { allowClerkGoogleFallback } from "@/lib/modules/auth/production-auth";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/google?next=/dashboard&popup=1
 * بدء Google OAuth الأصلي — بدون Clerk JS (موثوق على Safari/iPhone ويدعم النوافذ المنبثقة).
 */
export async function GET(request: NextRequest) {
  await hydrateEnvFromSettings().catch(() => 0);

  const isPopup = request.nextUrl.searchParams.get("popup") === "1";
  const cfg = getGoogleOAuthConfig();
  if (!cfg) {
    const next = resolvePostAuthNext({ next: request.nextUrl.searchParams.get("next") });
    // على الإنتاج: لا نسقط إلى Clerk Development (pk_test_) — يطلب إعداد Google الأصلي أو Clerk live.
    if (!allowClerkGoogleFallback()) {
      const fail = new URL("/sign-in", request.url);
      fail.searchParams.set("error", "google_keys_required");
      fail.searchParams.set("next", next);
      return NextResponse.redirect(fail);
    }
    const q = new URLSearchParams({ provider: "google", mode: "sign-in", next });
    if (isPopup) q.set("popup", "1");
    return NextResponse.redirect(new URL(`/api/auth/oauth/start?${q}`, request.url));
  }

  const next = resolvePostAuthNext({ next: request.nextUrl.searchParams.get("next") });
  const ref = request.nextUrl.searchParams.get("ref");
  const state = newOAuthState();
  const origin = request.nextUrl.origin;
  const redirectUri = googleCallbackUrl(origin);
  const authUrl = buildGoogleAuthUrl(cfg.clientId, redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  const secure = request.nextUrl.protocol === "https:";
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 600,
  };
  res.cookies.set(GOOGLE_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(OAUTH_NEXT_COOKIE, safeNextPath(next), cookieOpts);
  if (isPopup) res.cookies.set(GOOGLE_POPUP_COOKIE, "1", cookieOpts);
  if (ref) res.cookies.set(OAUTH_REF_COOKIE, ref, cookieOpts);
  return res;
}
