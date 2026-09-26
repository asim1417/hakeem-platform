import { NextRequest, NextResponse } from "next/server";
import { claimSessionFromClerkReturn } from "@/lib/modules/auth/claim-clerk-return";
import { resolvePostLoginNext } from "@/lib/modules/auth/home-destination";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";
import { attachLoginSessionCookie } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/claim-clerk-session  { token, next }
 *
 * بعد دخول نموذج حكيم العربي (Clerk على العميل فقط) يرسل العميل رمز جلسة Clerk القصير،
 * فيتحقق منه الخادم ويثبّت hakeem_session — كما يفعل مسار العودة من بوابة Clerk.
 * الرمز في جسم الطلب لا في الرابط، والطلب مقصور على الأصل نفسه.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let body: { token?: unknown; next?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; next?: unknown };
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });
  const nextSafe = safeDashboardNext(typeof body.next === "string" ? body.next : null, "/dashboard");

  const user = await claimSessionFromClerkReturn({ sessionJwt: token }).catch(() => null);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const res = NextResponse.json({ ok: true, next: resolvePostLoginNext(user, nextSafe) });
  attachLoginSessionCookie(res, user, { secure: request.nextUrl.protocol === "https:" });
  return res;
}
