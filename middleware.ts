import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/audit-logs"];

// مطابق لـ isAuthDisabled في session.ts: الدخول معطّل افتراضيًا؛ يُفرَض فقط بـ REQUIRE_AUTH=true.
function authDisabled() {
  const f = (process.env.REQUIRE_AUTH ?? "").toLowerCase();
  return !(f === "true" || f === "1" || f === "on");
}

export function middleware(request: NextRequest) {
  // وضع «بدون تسجيل دخول»: نسمح بجميع المسارات دون إعادة توجيه إلى صفحة الدخول.
  if (authDisabled()) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  const hasSession = Boolean(request.cookies.get("hakeem_session")?.value);
  if (hasSession) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/audit-logs"]
};
