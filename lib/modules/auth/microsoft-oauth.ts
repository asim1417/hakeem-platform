// ─────────────────────────────────────────────────────────────────────────────
// microsoft-oauth — تسجيل الدخول عبر Microsoft Entra ID (Azure AD / بوابة الدخول)
// OAuth 2.0 / OpenID Connect بمسار مباشر (fetch). اختياري بالكامل:
// إن لم تُضبط AZURE_AD_CLIENT_ID/SECRET يُعَدّ غير مُفعّل.
// ─────────────────────────────────────────────────────────────────────────────
import { newOAuthState } from "@/lib/modules/auth/oauth-shared";

export type MicrosoftOAuthConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
};

/** يقرأ إعداد Entra ID من البيئة؛ null إن غاب أحد المفتاحين الأساسيين. */
export function getMicrosoftOAuthConfig(): MicrosoftOAuthConfig | null {
  const clientId = (process.env.AZURE_AD_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "").trim();
  const clientSecret = (process.env.AZURE_AD_CLIENT_SECRET || process.env.MICROSOFT_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return null;
  const tenantId = (process.env.AZURE_AD_TENANT_ID || process.env.MICROSOFT_TENANT_ID || "common").trim() || "common";
  return { clientId, clientSecret, tenantId };
}

export function isMicrosoftOAuthConfigured(): boolean {
  return getMicrosoftOAuthConfig() !== null;
}

/**
 * عنوان إعادة التوجيه — يجب أن يطابق حرفيًّا ما سُجّل في Entra ID App Registration
 * (Authentication → Redirect URIs).
 */
export function microsoftCallbackUrl(origin: string): string {
  const base = (process.env.OAUTH_REDIRECT_BASE || origin).replace(/\/+$/, "");
  return `${base}/api/auth/callback/microsoft`;
}

export const MICROSOFT_STATE_COOKIE = "hakeem_ms_state";

export { newOAuthState };

function authorityBase(tenantId: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0`;
}

/** يبني رابط تفويض Microsoft Entra (بوابة الدخول). */
export function buildMicrosoftAuthUrl(cfg: MicrosoftOAuthConfig, redirectUri: string, state: string): string {
  const url = new URL(`${authorityBase(cfg.tenantId)}/authorize`);
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "openid email profile User.Read");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export type MicrosoftProfile = {
  id: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
};

type GraphMe = {
  id?: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string | null;
  otherMails?: string[];
};

/** يبادل رمز التفويض بـ access_token ثم يجلب ملف المستخدم من Microsoft Graph. */
export async function exchangeMicrosoftCodeForProfile(
  cfg: MicrosoftOAuthConfig,
  code: string,
  redirectUri: string
): Promise<MicrosoftProfile | null> {
  try {
    const tokenRes = await fetch(`${authorityBase(cfg.tenantId)}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "openid email profile User.Read",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!tokenRes.ok) return null;
    const token = (await tokenRes.json()) as { access_token?: string; id_token?: string };
    if (!token.access_token) return null;

    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!profileRes.ok) return null;
    const me = (await profileRes.json()) as GraphMe;
    if (!me.id) return null;

    const email =
      (me.mail || "").trim() ||
      (me.userPrincipalName || "").trim() ||
      (me.otherMails?.[0] || "").trim() ||
      emailFromIdToken(token.id_token);

    return {
      id: me.id,
      email: email || undefined,
      name: me.displayName || undefined,
      emailVerified: Boolean(email),
    };
  } catch {
    return null;
  }
}

/** يستخرج البريد من id_token عند غياب mail في Graph (حسابات شخصية أحيانًا). */
function emailFromIdToken(idToken?: string): string {
  if (!idToken) return "";
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return "";
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: string;
      preferred_username?: string;
      upn?: string;
    };
    return (json.email || json.preferred_username || json.upn || "").trim();
  } catch {
    return "";
  }
}
