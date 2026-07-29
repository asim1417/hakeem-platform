/**
 * وجهة الدخول حسب الدور — السوبر يدخل لوحة الإدارة لا داشبورد العميل.
 * وحدة خفيفة بلا server-only لتسهيل الاختبارات والاستيراد الآمن.
 */
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

type Actor = { role: string } | null | undefined;

function superPanelEnabled(): boolean {
  return process.env.SUPER_ADMIN_PANEL_ENABLED !== "0";
}

function isSuper(user: Actor): boolean {
  return user?.role === "SUPER_ADMIN";
}

function pathOnly(raw: string): string {
  return raw.split("?")[0]?.split("#")[0] || "";
}

function hasPlatformWindowFlag(next: string): boolean {
  const q = next.includes("?") ? next.slice(next.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  const v = params.get("platform");
  return v === "1" || v === "true";
}

/** الصفحة الرئيسية بعد تسجيل الدخول. */
export function defaultHomeForUser(user: Actor): string {
  if (isSuper(user) && superPanelEnabled()) return "/admin";
  return "/dashboard";
}

/**
 * يحلّ next بعد المصادقة.
 * `/dashboard` العام → `/admin` للسوبر.
 * `/dashboard?platform=1` يبقى نافذة معاينة للمنصة.
 */
export function resolvePostLoginNext(user: Actor, nextRaw?: string | null): string {
  const fallback = defaultHomeForUser(user);
  const next = safeDashboardNext(nextRaw, fallback);
  if (
    isSuper(user) &&
    superPanelEnabled() &&
    pathOnly(next) === "/dashboard" &&
    !hasPlatformWindowFlag(next)
  ) {
    return "/admin";
  }
  return next;
}

/** رابط نافذة المنصة (عرض كعميل) مع علامة واضحة للعودة. */
export const PLATFORM_WINDOW_HREF = "/dashboard?platform=1";
