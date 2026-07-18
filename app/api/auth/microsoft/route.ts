import { NextRequest, NextResponse } from "next/server";
import {
  getMicrosoftOAuthConfig,
  microsoftCallbackUrl,
  buildMicrosoftAuthUrl,
  newOAuthState,
  MICROSOFT_STATE_COOKIE,
} from "@/lib/modules/auth/microsoft-oauth";
import { OAUTH_NEXT_COOKIE, OAUTH_REF_COOKIE } from "@/lib/modules/auth/oauth-shared";

export const dynamic = "force-dynamic";

// GET /api/auth/microsoft — يبدأ تدفّق Entra ID (بوابة الدخول): يحفظ state ويحوّل إلى Microsoft.
export async function GET(request: NextRequest) {
  const cfg = getMicrosoftOAuthConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL("/login?error=microsoft_disabled", request.nextUrl.origin));
  }
  const state = newOAuthState();
  const redirectUri = microsoftCallbackUrl(request.nextUrl.origin);
  const authUrl = buildMicrosoftAuthUrl(cfg, redirectUri, state);

  const res = NextResponse.redirect(authUrl);
  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(MICROSOFT_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });
  const next = request.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    res.cookies.set(OAUTH_NEXT_COOKIE, next, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });
  }
  const ref = (request.nextUrl.searchParams.get("ref") || "").trim().toUpperCase();
  if (ref.startsWith("HKM-") && ref.length <= 32) {
    res.cookies.set(OAUTH_REF_COOKIE, ref, { httpOnly: true, sameSite: "lax", secure, maxAge: 600, path: "/" });
  }
  return res;
}
