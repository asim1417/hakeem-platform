/**
 * وجهة آمنة بعد المصادقة — مسارات /dashboard فقط.
 */
export function safeDashboardNext(raw?: string | null, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw === "/dashboard" || raw.startsWith("/dashboard/")) return raw;
  // مسارات منتج محمية شائعة → تُلفّ داخل dashboard إن وُجدت كمسارات مباشرة
  if (raw === "/documents" || raw.startsWith("/documents/")) return raw;
  if (raw === "/admin" || raw.startsWith("/admin/")) return raw;
  return fallback;
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
