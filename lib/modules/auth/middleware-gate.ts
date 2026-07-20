import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/audit-logs", "/onboarding"] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function hasOwnerSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)hakeem_session=/.test(cookieHeader);
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
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}
