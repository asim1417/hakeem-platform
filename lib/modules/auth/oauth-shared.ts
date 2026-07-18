// ─────────────────────────────────────────────────────────────────────────────
// oauth-shared — مشترك نقي بين مزوّدي OAuth (Google / Microsoft Entra).
// بلا اعتماد على Prisma/جلسات — آمن للاستيراد من وحدات الخادم فقط حالياً.
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "crypto";

export const OAUTH_NEXT_COOKIE = "hakeem_oauth_next";

/** رمز state عشوائي لمنع CSRF — يُحفظ في كوكي httpOnly ويُقارَن في callback. */
export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** قائمة البُرد التي تُمنح دور SYSTEM_ADMIN عند دخولها عبر OAuth (OAUTH_ADMIN_EMAILS مفصولة بفواصل). */
export function isOAuthAdminEmail(email: string): boolean {
  const fromEnv = (process.env.OAUTH_ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // بريد المالك الافتراضي إن لم تُضبط القائمة — يمكن تجاوزه بـ OAUTH_ADMIN_EMAILS.
  const defaults = fromEnv.length > 0 ? fromEnv : ["aasemalfarsi@gmail.com"];
  return defaults.includes(email.toLowerCase().trim());
}

/** مسار العودة الآمن بعد OAuth (مسار داخلي فقط). */
export function safeNextPath(raw?: string | null, fallback = "/dashboard"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
