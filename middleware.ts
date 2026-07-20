import { NextResponse, type NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/audit-logs(.*)",
  "/onboarding(.*)",
]);

function clerkReady() {
  return Boolean(
    (process.env.CLERK_SECRET_KEY || "").trim() &&
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim()
  );
}

function hasOwnerSession(request: NextRequest) {
  return Boolean(request.cookies.get("hakeem_session")?.value);
}

function ownerOrSetupGate(request: NextRequest) {
  if (!isProtectedRoute(request)) return NextResponse.next();
  // جلسة طوارئ المالك تسمح بالمرور بلا Clerk
  if (hasOwnerSession(request)) return NextResponse.next();
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("setup", "1");
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(url);
}

/**
 * Clerk إن وُجدت المفاتيح؛ وإلا جلسة المالك الطارئة (hakeem_session).
 */
export default clerkMiddleware(async (auth, request) => {
  if (!clerkReady()) return ownerOrSetupGate(request);

  // مع Clerk: اسمح أيضًا بجلسة المالك الطارئة
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
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
