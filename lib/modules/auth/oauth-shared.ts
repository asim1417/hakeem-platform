// ─────────────────────────────────────────────────────────────────────────────
// oauth-shared — مشترك نقي بين مزوّدي OAuth (Google / Microsoft Entra).
// بلا اعتماد على Prisma/جلسات — آمن للاستيراد من وحدات الخادم فقط حالياً.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "crypto";

export const OAUTH_NEXT_COOKIE = "hakeem_oauth_next";

/**
 * بريد مالك المنصة — يُمنح SYSTEM_ADMIN دائمًا عند الدخول عبر Google / Microsoft / التسجيل.
 * لا يُزال حتى لو ضُبطت OAUTH_ADMIN_EMAILS بقائمة أخرى (تُضاف إليها).
 */
export const PLATFORM_OWNER_EMAILS = ["aasemalfarsi@gmail.com"] as const;

/** رمز state عشوائي لمنع CSRF — يُحفظ في كوكي httpOnly ويُقارَن في callback. */
export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** هل هذا البريد مالك/مدير OAuth؟ (المالك الثابت + OAUTH_ADMIN_EMAILS). */
export function isOAuthAdminEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;
  const fromEnv = (process.env.OAUTH_ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const owners = new Set<string>([...PLATFORM_OWNER_EMAILS, ...fromEnv]);
  return owners.has(normalized);
}

/** مسار العودة الآمن بعد OAuth (مسار داخلي فقط). */
export function safeNextPath(raw?: string | null, fallback = "/dashboard"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
