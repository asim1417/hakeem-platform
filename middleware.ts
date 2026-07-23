import { type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { plainAuthGate } from "@/lib/modules/auth/middleware-gate";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/audit-logs(.*)",
  "/onboarding(.*)",
]);

const isAuthEntryRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/login"]);

function hasOwnerSession(request: NextRequest) {
  return Boolean(request.cookies.get("hakeem_session")?.value);
}

type ClerkMw = (req: NextRequest, event: NextFetchEvent) => Response | Promise<Response>;

let clerkHandler: ClerkMw | null = null;

function getClerkHandler(): ClerkMw {
  if (clerkHandler) return clerkHandler;
  clerkHandler = clerkMiddleware(async (auth, request) => {
    const session = await auth();

    // مسجّل بالفعل → لا تُبقِه في صفحات الدخول؛ احترم ?next إن كان آمنًا
    if (session.userId && isAuthEntryRoute(request)) {
      const nextRaw = request.nextUrl.searchParams.get("next");
      const next =
        nextRaw &&
        nextRaw.startsWith("/") &&
        !nextRaw.startsWith("//") &&
        (nextRaw === "/dashboard" ||
          nextRaw.startsWith("/dashboard/") ||
          nextRaw === "/documents" ||
          nextRaw.startsWith("/documents/") ||
          nextRaw === "/admin" ||
          nextRaw.startsWith("/admin/"))
          ? nextRaw
          : "/dashboard";
      return NextResponse.redirect(new URL(next, request.url));
    }

    if (isProtectedRoute(request) && hasOwnerSession(request)) {
      return NextResponse.next();
    }

    if (isProtectedRoute(request)) {
      await auth.protect({
        unauthenticatedUrl: new URL(
          `/sign-in?next=${encodeURIComponent(request.nextUrl.pathname)}`,
          request.url
        ).toString(),
      });
    }
  }) as ClerkMw;
  return clerkHandler;
}

/**
 * بدون مفاتيح Clerk لا نستدعي clerkMiddleware أصلًا —
 * استدعاؤه بلا مفاتيح يُسقِط الإنتاج بـ MIDDLEWARE_INVOCATION_FAILED.
 */
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!isClerkConfigured()) {
    // جلسة مالك على /sign-in → اللوحة
    if (hasOwnerSession(request) && isAuthEntryRoute(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return plainAuthGate(request);
  }
  return getClerkHandler()(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
