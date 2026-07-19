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

function legacyGate(request: NextRequest) {
  if (isProtectedRoute(request)) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("setup", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/**
 * Clerk هو بوابة المصادقة الوحيدة.
 * بلا مفاتيح: المسارات المحمية → /sign-in?setup=1
 */
export default clerkMiddleware(async (auth, request) => {
  if (!clerkReady()) return legacyGate(request);

  if (isProtectedRoute(request)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", request.url).toString(),
    });
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
