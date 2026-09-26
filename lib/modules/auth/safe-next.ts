/**
 * وجهة آمنة بعد المصادقة — مسارات المنصة الداخلية فقط.
 * يقبل `next` أو `returnUrl` كمرادفين.
 */
/**
 * العودة إلى الصفحة الرئيسية بعد دخول بدأ من حوارها (احتياط حجب النافذة المنبثقة).
 * قيمة واحدة ثابتة — «/» وحدها ما زالت تعود إلى fallback كما كانت.
 */
export const HOME_AUTH_RETURN_PATH = "/?home_auth=1";

export function safeDashboardNext(raw?: string | null, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (raw === HOME_AUTH_RETURN_PATH) return raw;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw === "/dashboard" || raw.startsWith("/dashboard/")) return raw;
  if (raw === "/documents" || raw.startsWith("/documents/")) return raw;
  if (raw === "/admin" || raw.startsWith("/admin/")) return raw;
  if (raw === "/onboarding" || raw.startsWith("/onboarding/")) return raw;
  return fallback;
}

/** يختار next أو returnUrl أيهما وُجد بأمان. */
export function resolvePostAuthNext(params?: {
  next?: string | null;
  returnUrl?: string | null;
}): string {
  return safeDashboardNext(params?.next || params?.returnUrl);
}

export function continueUrl(nextUrl: string): string {
  return `/auth/continue?next=${encodeURIComponent(safeDashboardNext(nextUrl))}`;
}

/** رابط تسجيل يحفظ الوجهة المقصودة. */
export function signInWithNext(nextPath: string): string {
  const next = safeDashboardNext(nextPath);
  return `/sign-in?next=${encodeURIComponent(next)}`;
}

export function signUpWithNext(nextPath: string): string {
  const next = safeDashboardNext(nextPath);
  return `/sign-up?next=${encodeURIComponent(next)}`;
}
