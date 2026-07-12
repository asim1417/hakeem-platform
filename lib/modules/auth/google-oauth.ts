// ─────────────────────────────────────────────────────────────────────────────
// google-oauth — تسجيل الدخول عبر Google (OAuth 2.0 / OpenID Connect) بمسار قياسي
// مباشر بلا مكتبة خارجية (fetch فقط) — أوثق وأخفّ من تثبيت مكتبة. اختياري بالكامل:
// إن لم تُضبط GOOGLE_CLIENT_ID/SECRET يُعَدّ غير مُفعّل ولا يظهر زرّه ولا تعمل مساراته.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "crypto";

export type GoogleOAuthConfig = { clientId: string; clientSecret: string };

/** يقرأ إعداد Google من البيئة؛ null إن غاب أحد المفتاحين (فالميزة معطّلة بأمان). */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isGoogleOAuthConfigured(): boolean {
  return getGoogleOAuthConfig() !== null;
}

/**
 * عنوان إعادة التوجيه (redirect_uri) — يجب أن يطابق **حرفيًّا** ما سُجّل في Google Console.
 * يُشتقّ من أصل الطلب (يعمل تلقائيًا على نطاق الإنتاج)، مع إمكان تجاوزه بـ OAUTH_REDIRECT_BASE.
 */
export function googleCallbackUrl(origin: string): string {
  const base = (process.env.OAUTH_REDIRECT_BASE || origin).replace(/\/+$/, "");
  return `${base}/api/auth/callback/google`;
}

/** قائمة البُرد التي تُمنح دور SYSTEM_ADMIN عند دخولها عبر Google (OAUTH_ADMIN_EMAILS مفصولة بفواصل). */
const ADMIN_EMAILS = (process.env.OAUTH_ADMIN_EMAILS || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export function isOAuthAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
}

export const GOOGLE_STATE_COOKIE = "hakeem_g_state";
export const OAUTH_NEXT_COOKIE = "hakeem_oauth_next";

/** رمز state عشوائي لمنع CSRF — يُحفظ في كوكي httpOnly ويُقارَن في callback. */
export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** يبني رابط تفويض Google. */
export function buildGoogleAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type GoogleProfile = { sub: string; email?: string; email_verified?: boolean; name?: string; picture?: string };

/** يبادل رمز التفويض بـ access_token ثم يجلب ملف المستخدم (email/name). null عند أي فشل. */
export async function exchangeGoogleCodeForProfile(
  cfg: GoogleOAuthConfig,
  code: string,
  redirectUri: string
): Promise<GoogleProfile | null> {
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return null;

    const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!profileRes.ok) return null;
    return (await profileRes.json()) as GoogleProfile;
  } catch {
    return null;
  }
}
