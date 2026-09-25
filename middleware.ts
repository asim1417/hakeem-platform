import { type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import {
  plainAuthGate,
  resolveUnauthenticatedGate,
} from "@/lib/modules/auth/middleware-gate";
import {
  HAKEEM_PATHNAME_HEADER,
  HAKEEM_SEARCH_HEADER,
  HAKEEM_CORRELATION_HEADER,
} from "@/lib/modules/auth/request-path-headers";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/audit-logs(.*)",
  "/onboarding(.*)",
]);

const isAuthEntryRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/login"]);

/**
 * مسارات عامة لا تشغّل clerkMiddleware —
 * يمنع تعليق Safari/iPhone بسبب handshake لـ dev-browser-missing على /sign-in.
 */
const isClerkMiddlewareBypass = createRouteMatcher([
  "/",
  // العرض العام للعناية الواجبة صناعي بالكامل ولا يحتاج هوية مستخدم أو Clerk.
  "/demo(.*)",
  "/api/due-diligence/demo(.*)",
  // خادم MCP: مسار عام تمامًا — لا يمسّه Clerk إطلاقًا (مستثنى أيضًا من matcher أدناه).
  // يمنع اعتراض clerkMiddleware الذي يردّ 401 فيُفسَّر لدى عميل MCP كدعوة OAuth.
  "/mcp(.*)",
  // واجهة ChatGPT العامة لأمان: أدوات ثابتة للفرز والتواصل فقط، بلا جلسة أو Clerk.
  "/aman/mcp(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login",
  "/register",
  "/pricing(.*)",
  "/privacy(.*)",
  "/terms(.*)",
  "/legal(.*)",
  // إكمال OAuth — عزل عن clerkMiddleware يمنع وميض الفشل مع dev-browser-missing
  "/auth/continue(.*)",
  "/sso-callback(.*)",
  "/api/auth/oauth/start(.*)",
  "/api/auth/account-portal(.*)",
  "/api/auth/google(.*)",
  "/api/auth/callback/google(.*)",
  "/api/auth/claim-clerk-return(.*)",
  "/api/auth/me(.*)",
  "/api/auth/providers(.*)",
]);

function hasOwnerSession(request: NextRequest) {
  return Boolean(request.cookies.get("hakeem_session")?.value);
}

/** يمرّر المسار للـ layouts عبر headers لتوجيه السوبر قبل رسم لوحة العميل. */
function nextWithPath(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(HAKEEM_PATHNAME_HEADER, request.nextUrl.pathname);
  requestHeaders.set(HAKEEM_SEARCH_HEADER, request.nextUrl.search);
  // مغلّف الحدث (§6): معرّف ارتباط لكل طلب — يُحترم الوارد إن وُجد، وإلا يُولَّد.
  const correlationId =
    request.headers.get(HAKEEM_CORRELATION_HEADER) || crypto.randomUUID();
  requestHeaders.set(HAKEEM_CORRELATION_HEADER, correlationId);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(HAKEEM_CORRELATION_HEADER, correlationId);
  return res;
}

type ClerkMw = (req: NextRequest, event: NextFetchEvent) => Response | Promise<Response>;

let clerkHandler: ClerkMw | null = null;

function getClerkHandler(): ClerkMw {
  if (clerkHandler) return clerkHandler;
  clerkHandler = clerkMiddleware(async (auth, request) => {
    const session = await auth();

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
      return nextWithPath(request);
    }

    if (isProtectedRoute(request)) {
      await auth.protect({
        unauthenticatedUrl: new URL(
          `/sign-in?next=${encodeURIComponent(request.nextUrl.pathname)}`,
          request.url
        ).toString(),
      });
    }

    return nextWithPath(request);
  }) as ClerkMw;
  return clerkHandler;
}

/**
 * بدون مفاتيح Clerk لا نستدعي clerkMiddleware أصلًا.
 * صفحات الدخول العامة تتجاوز clerkMiddleware حتى مع وجود المفاتيح.
 */
export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (!isClerkConfigured()) {
    if (hasOwnerSession(request) && isAuthEntryRoute(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    const decision = resolveUnauthenticatedGate(
      request.nextUrl.pathname,
      request.nextUrl.search,
      request.headers.get("cookie")
    );
    if (decision === "redirect-login") {
      return plainAuthGate(request);
    }
    return nextWithPath(request);
  }

  if (isClerkMiddlewareBypass(request)) {
    if (hasOwnerSession(request) && isAuthEntryRoute(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return nextWithPath(request);
  }

  return getClerkHandler()(request, event);
}

export const config = {
  matcher: [
    // استثناء نقاط MCP (وكل ما تحتها) من الـ middleware نهائيًا — تمرّ مباشرةً إلى
    // Route Handler بلا اعتراض Clerk ولا تحويل.
    "/((?!_next|mcp(?:/|$)|aman/mcp(?:/|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // مسار البروكسي التلقائي لـ Clerk (يلزم عند ترقية @clerk/nextjs لإصدار يدعمه).
    "/__clerk/:path*",
  ],
};
