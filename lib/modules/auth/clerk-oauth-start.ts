/**
 * بدء OAuth عبر Clerk Frontend API من الخادم — بلا JavaScript على جهاز المستخدم.
 * يعمل مع pk_test_ و cookieless_dev حيث يتعثّر Clerk React على Safari/iPhone.
 */
export type ClerkOAuthProvider = "google" | "apple";

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

export function clerkAccountPortalOrigin(fapiHost: string): string {
  const portalHost = fapiHost.replace(/\.clerk\.accounts\.dev$/, ".accounts.dev");
  return `https://${portalHost}`;
}

function strategyFor(provider: ClerkOAuthProvider): "oauth_google" | "oauth_apple" {
  return provider === "apple" ? "oauth_apple" : "oauth_google";
}

type FapiSignInResponse = {
  response?: {
    first_factor_verification?: {
      external_verification_redirect_url?: string;
    };
  };
  errors?: Array<{ code?: string; message?: string }>;
};

/** يطلب من Clerk رابط Google/Apple ويعيده. */
export async function fetchClerkOAuthAuthorizeUrl(opts: {
  provider: ClerkOAuthProvider;
  redirectUrl: string;
  redirectUrlComplete: string;
}): Promise<string> {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  const fapi = decodeClerkFrontendApiHost(pk);
  if (!fapi) throw new Error("invalid_publishable_key");

  const body = new URLSearchParams({
    strategy: strategyFor(opts.provider),
    redirect_url: opts.redirectUrl,
    action_complete_redirect_url: opts.redirectUrlComplete,
  });

  const res = await fetch(`https://${fapi}/v1/client/sign_ins?_clerk_js_version=5.61.0`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
  return url;
}

export function buildOAuthStartPath(opts: {
  provider: ClerkOAuthProvider;
  nextUrl?: string;
  mode?: "sign-in" | "sign-up";
}): string {
  const q = new URLSearchParams();
  q.set("provider", opts.provider);
  q.set("mode", opts.mode || "sign-in");
  if (opts.nextUrl) q.set("next", opts.nextUrl);
  return `/api/auth/oauth/start?${q.toString()}`;
}
