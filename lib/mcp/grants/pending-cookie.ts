/**
 * كوكي طلب الربط المعلّق: يحمل معاملات OAuth موقّعة من /oauth/authorize إلى شاشة الموافقة،
 * فتعبر صفحة الدخول دون أن تضيع (وجهة الدخول لا تحفظ معاملات الاستعلام).
 * HttpOnly + SameSite=Lax + عمر عشر دقائق. الـ nonce بداخله يربط نموذج الموافقة بالطلب (CSRF).
 */
import { PENDING_TTL_SEC } from "./tokens";

export const PENDING_COOKIE = "hakeem_mcp_authz";
export const CONSENT_PATH = "/connect/authorize";

export function pendingCookieHeader(value: string, secure: boolean): string {
  return [
    `${PENDING_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${PENDING_TTL_SEC}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearPendingCookieHeader(secure: boolean): string {
  return [`${PENDING_COOKIE}=`, "Path=/", "Max-Age=0", "HttpOnly", "SameSite=Lax", ...(secure ? ["Secure"] : [])].join("; ");
}

/** يقرأ قيمة الكوكي من ترويسة Cookie خام. */
export function readPendingCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PENDING_COOKIE) return rest.join("=") || null;
  }
  return null;
}
