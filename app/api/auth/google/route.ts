import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuthConfig,
  googleCallbackUrl,
  buildGoogleAuthUrl,
  newOAuthState,
  GOOGLE_STATE_COOKIE,
  OAUTH_NEXT_COOKIE,
} from "@/lib/modules/auth/google-oauth";

export const dynamic = "force-dynamic";

// GET /api/auth/google — يبدأ تدفّق OAuth: يحفظ state (CSRF) ويحوّل إلى صفحة موافقة Google.
export async function GET(request: NextRequest) {
  const cfg = getGoogleOAuthConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL("/login?error=google_disabled", request.nextUrl.origin));
  }
  const state = newOAuthState();
  const redirectUri = googleCallbackUrl(request.nextUrl.origin);
  const authUrl = buildGoogleAuthUrl(cfg.clientId, redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(GOOGLE_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/")) {
    res.cookies.set(OAUTH_NEXT_COOKIE, next, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });
  }
  return res;
}
