/**
 * بدء OAuth عبر Clerk — يفضّل Account Portal SSO (موثوق مع pk_test_/Safari)،
 * مع احتياطي FAPI + كوكي __clerk_db_jwt لربط العميل بالمتصفح.
 */
export type ClerkOAuthProvider = "google" | "apple" | "microsoft";

type ClerkOAuthStrategy = "oauth_google" | "oauth_apple" | "oauth_microsoft";

export function parseClerkOAuthProvider(raw?: string | null): ClerkOAuthProvider | null {
  const v = (raw || "").trim().toLowerCase();
  if (v === "google" || v === "apple" || v === "microsoft") return v;
  return null;
}

export function decodeClerkFrontendApiHost(publishableKey: string): string | null {
  const pk = publishableKey.trim();
  const m = pk.match(/^pk_(?:test|live)_(.+)$/);
  if (!m) return null;
  try {
    const decoded = Buffer.from(m[1], "base64").toString("utf8").replace(/\$$/, "").trim();
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * نطاق بوابة الحسابات (Account Portal):
 * - تطوير: xxx.clerk.accounts.dev ← xxx.accounts.dev
 * - إنتاج: clerk.example.com ← accounts.example.com
 * NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_URL يتقدّم على الاستنتاج عند ضبطه.
 */
export function clerkAccountPortalOrigin(fapiHost: string): string {
  const override = (process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL_URL || "").trim().replace(/\/+$/, "");
  if (/^https:\/\/[^/]+$/.test(override)) return override;
  const portalHost = fapiHost.endsWith(".clerk.accounts.dev")
    ? fapiHost.replace(/\.clerk\.accounts\.dev$/, ".accounts.dev")
    : fapiHost.replace(/^clerk\./, "accounts.");
  return `https://${portalHost}`;
}

function strategyFor(provider: ClerkOAuthProvider): ClerkOAuthStrategy {
  if (provider === "apple") return "oauth_apple";
  if (provider === "microsoft") return "oauth_microsoft";
  return "oauth_google";
}

/** صفحات بوابة الحسابات المستخدمة في حكيم. */
export type ClerkPortalPage =
  | "sign-in"
  | "sign-up"
  | "user"
  | "organization"
  | "create-organization";

/**
 * رابط صفحة في بوابة حسابات Clerk مع العودة إلى المنصة.
 * البوابة تعرض وسائل الدخول المفعّلة في اللوحة (بريد/جوال/رمز) وتفرض التحقق الثنائي.
 */
export function buildClerkPortalPageUrl(opts: {
  page: ClerkPortalPage;
  redirectUrl: string;
  publishableKey?: string;
}): string | null {
  const pk = (opts.publishableKey ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  const fapi = decodeClerkFrontendApiHost(pk);
  if (!fapi) return null;
  const url = new URL(`${clerkAccountPortalOrigin(fapi)}/${opts.page}`);
  url.searchParams.set("redirect_url", opts.redirectUrl);
  return url.toString();
}

type FapiSignInResponse = {
  response?: {
    first_factor_verification?: {
      external_verification_redirect_url?: string;
    };
  };
  errors?: Array<{ code?: string; message?: string }>;
};

export type ClerkOAuthStartResult = {
  /** رابط إعادة التوجيه النهائي (Portal أو Google/Apple) */
  redirectTo: string;
  /** JWT متصفح التطوير — يُضبط كوكي __clerk_db_jwt قبل المغادرة */
  devBrowserJwt?: string;
};

/**
 * المسار الأساسي: Account Portal /sign-in/sso?strategy=...
 * Clerk JS يعمل على نطاق Clerk فيكتمل handshake عند العودة للمنصة.
 */
export function buildClerkPortalSsoUrl(opts: {
  provider: ClerkOAuthProvider;
  redirectUrlComplete: string;
  publishableKey?: string;
}): string | null {
  const pk = (opts.publishableKey ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  const fapi = decodeClerkFrontendApiHost(pk);
  if (!fapi) return null;
  const portal = clerkAccountPortalOrigin(fapi);
  const url = new URL(`${portal}/sign-in/sso`);
  url.searchParams.set("strategy", strategyFor(opts.provider));
  url.searchParams.set("redirect_url", opts.redirectUrlComplete);
  return url.toString();
}

/**
 * احتياطي: إنشاء client + sign_in على FAPI مع JWT لربطه بالمتصفح.
 */
export async function fetchClerkOAuthAuthorizeUrl(opts: {
  provider: ClerkOAuthProvider;
  redirectUrl: string;
  redirectUrlComplete: string;
}): Promise<ClerkOAuthStartResult> {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  const fapi = decodeClerkFrontendApiHost(pk);
  if (!fapi) throw new Error("invalid_publishable_key");

  const clientRes = await fetch(`https://${fapi}/v1/client?_clerk_js_version=5.61.0`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "",
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!clientRes.ok) throw new Error("clerk_client_failed");
  const devBrowserJwt = (clientRes.headers.get("authorization") || "").trim() || undefined;

  const body = new URLSearchParams({
    strategy: strategyFor(opts.provider),
    redirect_url: opts.redirectUrl,
    action_complete_redirect_url: opts.redirectUrlComplete,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (devBrowserJwt) headers.Authorization = devBrowserJwt;

  const res = await fetch(`https://${fapi}/v1/client/sign_ins?_clerk_js_version=5.61.0`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });

  const data = (await res.json()) as FapiSignInResponse;
  const url = data?.response?.first_factor_verification?.external_verification_redirect_url;
  if (!url) {
    const code = data?.errors?.[0]?.code || "oauth_start_failed";
    throw new Error(code);
  }
  return { redirectTo: url, devBrowserJwt };
}

/** provider=email|phone يفتح صفحة الدخول/التسجيل في البوابة بدل OAuth مباشر. */
export type AuthStartProvider = ClerkOAuthProvider | "email" | "phone";

export function buildOAuthStartPath(opts: {
  provider: AuthStartProvider;
  nextUrl?: string;
  mode?: "sign-in" | "sign-up";
}): string {
  const q = new URLSearchParams();
  q.set("provider", opts.provider);
  q.set("mode", opts.mode || "sign-in");
  if (opts.nextUrl) q.set("next", opts.nextUrl);
  return `/api/auth/oauth/start?${q.toString()}`;
}
