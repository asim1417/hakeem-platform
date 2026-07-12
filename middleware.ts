import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/audit-logs"];

// مطابق لـ isAuthDisabled في session.ts (نسخة edge بلا استيراد prisma): تجاوز المالك الصريح
// AUTH_BYPASS يعمل في الإنتاج؛ وإلا المصادقة إلزامية في الإنتاج، وDISABLE_AUTH للتطوير المحلّي.
function authDisabled() {
  const bypass = (process.env.AUTH_BYPASS ?? "").toLowerCase();
  if (bypass === "true" || bypass === "1" || bypass === "on") return true;
  if (process.env.NODE_ENV === "production") return false;
  const flag = (process.env.DISABLE_AUTH ?? "").toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
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
