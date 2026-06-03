import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/audit-logs"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
  const hasSession = Boolean(request.cookies.get("hakeem_session")?.value);
  if (hasSession) return NextResponse.next();
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/audit-logs"]
};
