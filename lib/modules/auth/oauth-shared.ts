// ─────────────────────────────────────────────────────────────────────────────
// oauth-shared — مشترك نقي بين مزوّدي OAuth (Google / Microsoft Entra).
// بلا اعتماد على Prisma/جلسات. يُستورَد أيضًا من مكوّنات العميل (صفحتا الدخول/التسجيل)،
// لذا نتجنّب وحدة crypto العقديّة (تكسر حزمة المتصفّح/Edge) ونستخدم Web Crypto العامّة
// المتوفّرة في Node وEdge والمتصفّح جميعًا.
// ─────────────────────────────────────────────────────────────────────────────

export const OAUTH_NEXT_COOKIE = "hakeem_oauth_next";
/** رمز إحالة يُمرَّر عبر تدفّق OAuth من /register?ref= */
export const OAUTH_REF_COOKIE = "hakeem_oauth_ref";

/**
 * بريد مالك المنصة — يُمنح SUPER_ADMIN دائمًا عند الدخول عبر Clerk / OAuth / التسجيل.
 * لا يُزال حتى لو ضُبطت OAUTH_ADMIN_EMAILS بقائمة أخرى (تُضاف إليها كمدراء نظام).
 */
export const PLATFORM_OWNER_EMAILS = ["aasemalfarsi@gmail.com"] as const;

/** رمز state عشوائي لمنع CSRF — يُحفظ في كوكي httpOnly ويُقارَن في callback. */
export function newOAuthState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** هل هذا البريد مالك المنصة الثابت؟ */
export function isPlatformOwnerEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  return (PLATFORM_OWNER_EMAILS as readonly string[]).includes(normalized);
}

/** هل هذا البريد مالك/مدير OAuth؟ (المالك الثابت + OAUTH_ADMIN_EMAILS). */
export function isOAuthAdminEmail(email: string): boolean {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return false;
  if (isPlatformOwnerEmail(normalized)) return true;
  const fromEnv = (process.env.OAUTH_ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv.includes(normalized);
}

/** مسار العودة الآمن بعد OAuth (مسار داخلي فقط). */
export function safeNextPath(raw?: string | null, fallback = "/dashboard"): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
