import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/audit-logs", "/onboarding"];

/**
 * حماية المسارات الحساسة: بلا جلسة → صفحة التسجيل (فيها خيار تسجيل الدخول).
 * الرحلة من الرابط الرئيسي: سجّل / ادخل → onboarding أو المنصة.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get("hakeem_session")?.value);
  if (hasSession) return NextResponse.next();

  const gate = new URL("/register", request.url);
  gate.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(gate);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/audit-logs", "/onboarding"],
};
