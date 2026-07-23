/**
 * وجهة رجوع آمنة داخل منصة حكيم فقط — يمنع open-redirect.
 */
export function isSafeInternalPath(raw?: string | null): raw is string {
  if (!raw) return false;
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw.includes("://") || raw.includes("\\")) return false;
  return true;
}

/** مسارات شائعة بعد الدخول — للرجوع الاحتياطي حسب البادئة. */
const PARENT_FALLBACKS: Array<{ prefix: string; parent: string }> = [
  { prefix: "/dashboard/judicial-assistant/cases/", parent: "/dashboard/judicial-assistant/cases" },
  { prefix: "/dashboard/judicial-assistant", parent: "/dashboard" },
  { prefix: "/dashboard/legal-core/systems/", parent: "/dashboard/legal-core/systems" },
  { prefix: "/dashboard/legal-core/articles/", parent: "/dashboard/legal-core" },
  { prefix: "/dashboard/legal-core/judgments/", parent: "/dashboard/legal-core/judgments" },
  { prefix: "/dashboard/legal-core", parent: "/dashboard" },
  { prefix: "/dashboard/simulations/", parent: "/dashboard/simulations" },
  { prefix: "/dashboard/simulations", parent: "/dashboard" },
  { prefix: "/dashboard/agents/", parent: "/dashboard/agents" },
  { prefix: "/dashboard/agents", parent: "/dashboard" },
  { prefix: "/dashboard/ask", parent: "/dashboard" },
  { prefix: "/dashboard/files", parent: "/dashboard" },
  { prefix: "/dashboard/cases", parent: "/dashboard" },
  { prefix: "/dashboard/billing", parent: "/dashboard" },
  { prefix: "/dashboard/legal-search", parent: "/dashboard" },
  { prefix: "/admin/", parent: "/admin" },
  { prefix: "/admin", parent: "/dashboard" },
  { prefix: "/documents", parent: "/dashboard" },
  { prefix: "/audit-logs", parent: "/admin" },
];

export function fallbackParentPath(pathname: string, defaultPath = "/dashboard"): string {
  const hit = PARENT_FALLBACKS.find(
    (item) => pathname === item.prefix || pathname.startsWith(item.prefix)
  );
  return hit?.parent ?? defaultPath;
}

/**
 * يختار وجهة الرجوع: ?returnUrl الآمن → وإلا الأب المنطقي → وإلا /dashboard.
 * لا يعتمد على روابط خارجية.
 */
export function resolveReturnPath(
  pathname: string,
  returnUrl?: string | null,
  defaultPath = "/dashboard"
): string {
  if (isSafeInternalPath(returnUrl)) return returnUrl;
  return fallbackParentPath(pathname, defaultPath);
}

export function withReturnUrl(href: string, currentPath: string): string {
  if (!isSafeInternalPath(href)) return "/dashboard";
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}returnUrl=${encodeURIComponent(currentPath)}`;
}
