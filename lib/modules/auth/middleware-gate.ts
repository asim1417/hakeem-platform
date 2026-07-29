import { NextResponse, type NextRequest } from "next/server";
import { hasValidOwnerSessionCookie } from "@/lib/modules/auth/session-cookie-verify";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/audit-logs", "/onboarding"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function hasOwnerSessionCookie(cookieHeader: string | null | undefined): boolean {
  return hasValidOwnerSessionCookie(cookieHeader);
}

/**
 * بوابة بلا Clerk: المسارات المحمية تتطلب جلسة المالك أو إعادة توجيه لـ /login.
 */
export function resolveUnauthenticatedGate(
  pathname: string,
  search: string,
  cookieHeader: string | null | undefined
): "allow" | "redirect-login" {
  if (!isProtectedPath(pathname)) return "allow";
  if (hasOwnerSessionCookie(cookieHeader)) return "allow";
  return "redirect-login";
}

export function plainAuthGate(request: NextRequest) {
  const decision = resolveUnauthenticatedGate(
    request.nextUrl.pathname,
    request.nextUrl.search,
    request.headers.get("cookie")
  );
  if (decision === "allow") return NextResponse.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("setup", "1");
  const intended = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.searchParams.set("next", safeDashboardNext(intended));
  return NextResponse.redirect(url);
}
