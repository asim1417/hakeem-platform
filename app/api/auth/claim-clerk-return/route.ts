import { NextRequest, NextResponse } from "next/server";
import { claimSessionFromClerkReturn } from "@/lib/modules/auth/claim-clerk-return";
import { resolvePostLoginNext } from "@/lib/modules/auth/home-destination";
import { continueUrl, safeDashboardNext } from "@/lib/modules/auth/safe-next";
import {
  attachLoginSessionCookie,
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
  const fail = NextResponse.redirect(new URL(continueUrl(nextSafe), request.url));

  const user = await claimSessionFromClerkReturn({
    handshakeNonce: request.nextUrl.searchParams.get("__clerk_handshake_nonce"),
    handshakeToken: request.nextUrl.searchParams.get("__clerk_handshake"),
    sessionJwt: request.nextUrl.searchParams.get("__clerk_db_jwt"),
  }).catch(() => null);

  if (!user) return fail;

  const dest = resolvePostLoginNext(user, nextSafe);
  const secure = request.nextUrl.protocol === "https:";
  const res = NextResponse.redirect(new URL(dest, request.url));
  if (!mirrorLoginSessionCookie(res, { secure })) {
    attachLoginSessionCookie(res, user, { secure });
  }
  return res;
}
