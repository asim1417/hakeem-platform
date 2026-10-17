import { type NextRequest, type NextFetchEvent } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import {
  HOME_VIEW_PARAM,
  isHomeSignedInRedirectEnabled,
  LOGGED_OUT_MARK_COOKIE,
  shouldRedirectSignedInHome,
} from "@/lib/modules/config/home-signed-in-redirect";
import { isHomeInlineAuthEnabled } from "@/lib/modules/config/home-inline-auth";
import { singleSignInTarget } from "@/lib/modules/auth/single-sign-in";
import {
  plainAuthGate,
  resolveUnauthenticatedGate,
} from "@/lib/modules/auth/middleware-gate";
import {
  HAKEEM_PATHNAME_HEADER,
  HAKEEM_SEARCH_HEADER,
  HAKEEM_CORRELATION_HEADER,
} from "@/lib/modules/auth/request-path-headers";
import { workspaceHomeFromSessionCookie } from "@/lib/modules/auth/session-cookie-peek";
import { isMcpOauthPublicPath } from "@/lib/mcp/oauth-paths";
import { createLawTableLoader, decideLawRoute, LAW_NOT_FOUND_HTML, type LawRouteTable } from "@/lib/modules/legal-core/law-route-gate";

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
  // مصادقة الموصل تتم داخل المسار نفسه (مفتاح أو OAuth الخاص بـ MCP)، لا عبر Clerk.
  "/mcp(.*)",
  // اكتشاف OAuth وصفحة ربط الموصل يجب أن تبقيا خارج Clerk وإلا يفشل «بدء تسجيل الدخول» في Claude.
  "/.well-known/oauth-protected-resource(.*)",
  "/.well-known/oauth-authorization-server(.*)",
  "/oauth/authorize(.*)",
  "/oauth/token(.*)",
  "/oauth/register(.*)",
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
  "/law/(.*)",
  // إكمال OAuth — عزل عن clerkMiddleware يمنع وميض الفشل مع dev-browser-missing
  "/auth/continue(.*)",
  // نموذج الدخول العربي — Clerk يعمل فيه على العميل فقط، كما في /sign-in.
  "/auth/identifier(.*)",
  "/sso-callback(.*)",
  "/api/auth/oauth/start(.*)",
  "/api/auth/account-portal(.*)",
  "/api/auth/google(.*)",
  "/api/auth/callback/google(.*)",
  "/api/auth/claim-clerk-return(.*)",
  "/api/auth/claim-clerk-session(.*)",
  "/api/auth/me(.*)",
  "/api/auth/providers(.*)",
]);

function hasOwnerSession(request: NextRequest) {
  return Boolean(request.cookies.get("hakeem_session")?.value);
}

/** وجهة مساحة العمل من دور الكوكي — بلا DB؛ السوبر → /admin مباشرة (لا ومضة /dashboard). */
function workspaceHome(request: NextRequest): "/admin" | "/dashboard" {
  return workspaceHomeFromSessionCookie(request.cookies.get("hakeem_session")?.value, {
    superPanelEnabled: process.env.SUPER_ADMIN_PANEL_ENABLED !== "0",
  });
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
          : workspaceHome(request);
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

// HKM-023-B (م١): جدول مسارات /law مخزّن في ذاكرة الوسيط عشر دقائق؛ الفشل يُعاد بعد ثلاثين ثانية ولا يحجب الطلب.
// جلب واحد جارٍ تتشاركه الطلبات المتزامنة، بمهلة 1.5 ثانية؛ الفشل أو المهلة = يمر الطلب بالسلوك السابق (مراجعة الجودة م٢).
const loadLawTable = createLawTableLoader({ fetch: (url, init) => fetch(url, init) });

function getLawTable(request: NextRequest): Promise<LawRouteTable | null> {
  return loadLawTable(request.nextUrl.origin);
}

/** تحويل دائم و404 حقيقيان لمسارات /law وشجرة النظام القديمة في اللوحة، قبل أي رسم. */
async function lawRouteGate(request: NextRequest): Promise<Response | null> {
  const { pathname, search } = request.nextUrl;
  if (!pathname.startsWith("/law/") && !pathname.startsWith("/dashboard/legal-core/systems/")) return null;
  const table = await getLawTable(request);
  if (!table) return null;
  const d = decideLawRoute(pathname, search, table);
  if (d.kind === "redirect") return NextResponse.redirect(new URL(d.to, request.url), 301);
  if (d.kind === "not_found") return new NextResponse(LAW_NOT_FOUND_HTML, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  return null;
}

/**
 * بدون مفاتيح Clerk لا نستدعي clerkMiddleware أصلًا.
 * صفحات الدخول العامة تتجاوز clerkMiddleware حتى مع وجود المفاتيح.
 */
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const lawGate = await lawRouteGate(request);
  if (lawGate) return lawGate;

  // «/» للزائر و«/dashboard» لصاحب الجلسة: إحالة 307 قبل رسم الصفحة — وجود الكوكي فقط، بلا Clerk
  // (حماية iPhone). ‎/?view=home‎ يعرض الواجهة التعريفية بطلبه. مفتاح الطوارئ: HOME_SIGNED_IN_REDIRECT_ENABLED=0
  if (
    request.nextUrl.pathname === "/" &&
    shouldRedirectSignedInHome({
      enabled: isHomeSignedInRedirectEnabled(),
      hasSession: hasOwnerSession(request),
      view: request.nextUrl.searchParams.get(HOME_VIEW_PARAM),
      justLoggedOut: request.cookies.get(LOGGED_OUT_MARK_COOKIE)?.value === "1",
    })
  ) {
    return NextResponse.redirect(new URL(workspaceHome(request), request.url), 307);
  }

  // صفحة دخول واحدة: ‎/sign-up‎ و‎/register‎ و‎/login‎ و‎/auth/identifier‎ ← ‎/sign-in‎ (307، والوجهة محفوظة)
  if (isHomeInlineAuthEnabled()) {
    const target = singleSignInTarget(request.nextUrl.pathname, request.nextUrl.searchParams);
    if (target) return NextResponse.redirect(new URL(target, request.url), 307);
  }

  if (!isClerkConfigured()) {
    if (hasOwnerSession(request) && isAuthEntryRoute(request)) {
      return NextResponse.redirect(new URL(workspaceHome(request), request.url));
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

  if (isClerkMiddlewareBypass(request) || isMcpOauthPublicPath(request.nextUrl.pathname)) {
    if (hasOwnerSession(request) && isAuthEntryRoute(request)) {
      return NextResponse.redirect(new URL(workspaceHome(request), request.url));
    }
    return nextWithPath(request);
  }

  return getClerkHandler()(request, event);
}

export const config = {
  matcher: [
    // استثناء نقاط MCP (وكل ما تحتها) من الـ middleware نهائيًا — تمرّ مباشرةً إلى
    // Route Handler بلا اعتراض Clerk ولا تحويل.
    "/((?!_next|mcp(?:/|$)|aman/mcp(?:/|$)|\\.well-known/oauth-(?:protected-resource|authorization-server)(?:/|$)|oauth/(?:authorize|token|register)(?:/|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    // مسار البروكسي التلقائي لـ Clerk (يلزم عند ترقية @clerk/nextjs لإصدار يدعمه).
    "/__clerk/:path*",
  ],
};
