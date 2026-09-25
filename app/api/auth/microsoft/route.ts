import { NextRequest, NextResponse } from "next/server";
import { buildOAuthStartPath } from "@/lib/modules/auth/clerk-oauth-start";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";

/** أُلغي Entra اليدوي — Microsoft يمر عبر Clerk (oauth_microsoft) بعلم AUTH_MICROSOFT_ENABLED. */
export async function GET(request: NextRequest) {
  const nextUrl = resolvePostAuthNext({
    next: request.nextUrl.searchParams.get("next") || undefined,
  });
  return NextResponse.redirect(
    new URL(buildOAuthStartPath({ provider: "microsoft", nextUrl }), request.url)
  );
}
