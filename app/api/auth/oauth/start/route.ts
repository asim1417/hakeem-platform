import { NextRequest, NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import {
  clerkAccountPortalOrigin,
  decodeClerkFrontendApiHost,
  fetchClerkOAuthAuthorizeUrl,
  type ClerkOAuthProvider,
} from "@/lib/modules/auth/clerk-oauth-start";
import { continueUrl, resolvePostAuthNext } from "@/lib/modules/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/oauth/start?provider=google|apple&next=/dashboard
 * يبدأ OAuth من الخادم ويعيد التوجيه إلى Google/Apple مباشرة — بدون Clerk JS على iPhone.
 */
export async function GET(request: NextRequest) {
  if (!isClerkConfigured()) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const providerRaw = (request.nextUrl.searchParams.get("provider") || "google").toLowerCase();
  const provider: ClerkOAuthProvider = providerRaw === "apple" ? "apple" : "google";
  const mode = request.nextUrl.searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in";
  const nextUrl = resolvePostAuthNext({
    next: request.nextUrl.searchParams.get("next") || undefined,
  });

  const origin = request.nextUrl.origin;
  const redirectUrl = `${origin}/sso-callback`;
  const redirectUrlComplete = `${origin}${continueUrl(nextUrl)}`;

  try {
    const authorizeUrl = await fetchClerkOAuthAuthorizeUrl({
      provider,
      redirectUrl,
      redirectUrlComplete,
    });
    return NextResponse.redirect(authorizeUrl);
  } catch {
    // احتياطي: بوابة Clerk المستضافة (Account Portal)
    const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
    const fapi = decodeClerkFrontendApiHost(pk);
    if (!fapi) {
      return NextResponse.redirect(new URL(`/${mode === "sign-up" ? "sign-up" : "sign-in"}`, request.url));
    }
    const portal = clerkAccountPortalOrigin(fapi);
    const path = mode === "sign-up" ? "/sign-up" : "/sign-in";
    const url = new URL(`${portal}${path}`);
    url.searchParams.set("redirect_url", redirectUrlComplete);
    return NextResponse.redirect(url.toString());
  }
}
