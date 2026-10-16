import { NextRequest, NextResponse } from "next/server";
import { claimSessionFromClerkReturn } from "@/lib/modules/auth/claim-clerk-return";
import { resolvePostLoginNext } from "@/lib/modules/auth/home-destination";
import { continueUrl, safeDashboardNext } from "@/lib/modules/auth/safe-next";
import { oauthPopupResponse } from "@/lib/modules/auth/oauth-popup-response";
import {
  attachLoginSessionCookie,
  getCurrentUser,
  mirrorLoginSessionCookie,
} from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/claim-clerk-return
 * يثبت hakeem_session من معاملات Clerk على Route Handler (يُسمح بتعديل الكوكيز هنا)،
 * ثم يوجّه للوجهة — لا يستدعى cookies().set من صفحة RSC.
 */
export async function GET(request: NextRequest) {
  const nextRaw = request.nextUrl.searchParams.get("next");
  const nextSafe = safeDashboardNext(nextRaw, "/dashboard");
  const isPopup = request.nextUrl.searchParams.get("popup") === "1";

  const claimed = await claimSessionFromClerkReturn({
    handshakeNonce: request.nextUrl.searchParams.get("__clerk_handshake_nonce"),
    handshakeToken: request.nextUrl.searchParams.get("__clerk_handshake"),
    sessionJwt: request.nextUrl.searchParams.get("__clerk_db_jwt"),
  }).catch(() => null);
  // النافذة المنبثقة قد تصل بجلسة hakeem_session قائمة (من /auth/continue)
  const user = claimed ?? (isPopup ? await getCurrentUser().catch(() => null) : null);

  if (!user) {
    return isPopup
      ? oauthPopupResponse({ ok: false, provider: "clerk", next: nextSafe, error: "session_claim_failed" })
      : NextResponse.redirect(new URL(continueUrl(nextSafe), request.url));
  }

  const dest = resolvePostLoginNext(user, nextSafe);
  const secure = request.nextUrl.protocol === "https:";
  const res = isPopup
    ? oauthPopupResponse({ ok: true, provider: "clerk", next: dest })
    : NextResponse.redirect(new URL(dest, request.url));
  if (!mirrorLoginSessionCookie(res, { secure })) {
    attachLoginSessionCookie(res, user, { secure });
  }
  return res;
}
