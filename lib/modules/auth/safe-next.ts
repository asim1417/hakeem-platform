/**
 * وجهة آمنة بعد المصادقة — مسارات المنصة الداخلية فقط.
 * يقبل `next` أو `returnUrl` كمرادفين، ويحافظ على query آمِن (مثل platform=1).
 */

const ALLOWED_PREFIXES = ["/dashboard", "/documents", "/admin", "/onboarding"] as const;

function pathOnly(raw: string): string {
  return raw.split("?")[0]?.split("#")[0] || "";
}

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** يصفّي الاستعلام إلى مفاتيح معروفة فقط — يمنع حقن بارامترات غريبة. */
function sanitizeSearch(raw: string): string {
  const qIndex = raw.indexOf("?");
  if (qIndex < 0) return "";
  const params = new URLSearchParams(raw.slice(qIndex + 1));
  const out = new URLSearchParams();
  for (const key of ["platform", "welcome", "q", "mode"]) {
    const v = params.get(key);
    if (v != null && v.length <= 200) out.set(key, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

/**
 * وجهة آمنة بعد المصادقة.
 * يدعم `/dashboard?platform=1` (نافذة المنصة للسوبر).
 */
export function safeDashboardNext(raw?: string | null, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  const pathname = pathOnly(raw);
  if (!pathname || !isAllowedPath(pathname)) return fallback;
  return `${pathname}${sanitizeSearch(raw)}`;
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
