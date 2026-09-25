import { NextRequest, NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import {
  isAppleSignInAvailable,
  isEmailCodeSignInAvailable,
  isMicrosoftSignInAvailable,
  isPhoneSignInAvailable,
} from "@/lib/modules/auth/auth-providers";
import { getGoogleOAuthConfig } from "@/lib/modules/auth/google-oauth";
import {
  buildClerkPortalPageUrl,
  buildClerkPortalSsoUrl,
  clerkAccountPortalOrigin,
  decodeClerkFrontendApiHost,
  fetchClerkOAuthAuthorizeUrl,
  parseClerkOAuthProvider,
} from "@/lib/modules/auth/clerk-oauth-start";
import { continueUrl, resolvePostAuthNext } from "@/lib/modules/auth/safe-next";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

const DEV_BROWSER_COOKIE = "__clerk_db_jwt";

function withDevBrowserCookie(response: NextResponse, jwt?: string) {
  if (!jwt) return response;
  response.cookies.set(DEV_BROWSER_COOKIE, jwt, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

/**
 * GET /api/auth/oauth/start?provider=google|microsoft|apple|email|phone&next=/dashboard
 *
 * Google: إن وُجدت مفاتيح Google → OAuth أصلي (/api/auth/google) + hakeem_session.
 * وإلا / لـ Microsoft وApple: Clerk Portal SSO ثم claim عند العودة.
 * email / phone: صفحة الدخول أو التسجيل في بوابة Clerk (رمز تحقق + التحقق الثنائي إن فُعّل).
 * أي وسيلة غير مفعّلة بعلمها تعود إلى /sign-in بدل بدء استراتيجية معطّلة في Clerk.
 */
export async function GET(request: NextRequest) {
  await hydrateEnvFromSettings().catch(() => 0);

  const providerRaw = (request.nextUrl.searchParams.get("provider") || "google").toLowerCase();
  const identifier = providerRaw === "email" || providerRaw === "phone" ? providerRaw : null;
  // قيمة غير معروفة تُعامل كـ Google كما كان سابقًا.
  const provider = identifier ? null : parseClerkOAuthProvider(providerRaw) ?? "google";
  const mode = request.nextUrl.searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in";
  const nextUrl = resolvePostAuthNext({
    next: request.nextUrl.searchParams.get("next") || undefined,
  });

  // ── المسار الجذري لـ Google: OAuth أصلي بلا Clerk JS ──
  if (provider === "google" && getGoogleOAuthConfig()) {
    const q = new URLSearchParams({ next: nextUrl });
    return NextResponse.redirect(new URL(`/api/auth/google?${q}`, request.url));
  }

  if (!isClerkConfigured()) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const origin = request.nextUrl.origin;
  const redirectUrl = `${origin}/sso-callback`;
  const redirectUrlComplete = `${origin}${continueUrl(nextUrl)}`;
  const backToSignIn = NextResponse.redirect(
    new URL(mode === "sign-up" ? "/sign-up" : "/sign-in", request.url)
  );

  // ── البريد برمز تحقق / الجوال برمز OTP: صفحة البوابة المستضافة ──
  if (!provider) {
    const enabled =
      identifier === "email" ? isEmailCodeSignInAvailable() : isPhoneSignInAvailable();
    if (!enabled) return backToSignIn;
    const portalPage = buildClerkPortalPageUrl({
      page: mode === "sign-up" ? "sign-up" : "sign-in",
      redirectUrl: redirectUrlComplete,
    });
    return portalPage ? NextResponse.redirect(portalPage) : backToSignIn;
  }

  if (provider === "apple" && !isAppleSignInAvailable()) return backToSignIn;
  if (provider === "microsoft" && !isMicrosoftSignInAvailable()) return backToSignIn;

  const portalSso = buildClerkPortalSsoUrl({
    provider,
    redirectUrlComplete,
  });
  if (portalSso) {
    return NextResponse.redirect(portalSso);
  }

  try {
    const { redirectTo, devBrowserJwt } = await fetchClerkOAuthAuthorizeUrl({
      provider,
      redirectUrl,
      redirectUrlComplete,
    });
    return withDevBrowserCookie(NextResponse.redirect(redirectTo), devBrowserJwt);
  } catch {
    const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
    const fapi = decodeClerkFrontendApiHost(pk);
    if (!fapi) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    const portal = clerkAccountPortalOrigin(fapi);
    const path = mode === "sign-up" ? "/sign-up" : "/sign-in";
    const url = new URL(`${portal}${path}`);
    url.searchParams.set("redirect_url", redirectUrlComplete);
    return NextResponse.redirect(url.toString());
  }
}
