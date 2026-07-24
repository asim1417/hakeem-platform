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

/** الصفحة الرئيسية بعد تسجيل الدخول. */
export function defaultHomeForUser(user: Actor): string {
  if (isSuper(user) && superPanelEnabled()) return "/admin";
  return "/dashboard";
}

/**
 * يحلّ next بعد المصادقة.
 * `/dashboard` العام → `/admin` للسوبر؛ المسارات الأعمق تبقى نافذة للمنصة.
 */
export function resolvePostLoginNext(user: Actor, nextRaw?: string | null): string {
  const fallback = defaultHomeForUser(user);
  const next = safeDashboardNext(nextRaw, fallback);
  if (isSuper(user) && superPanelEnabled() && next === "/dashboard") {
    return "/admin";
  }
  return next;
}

/** رابط نافذة المنصة (عرض كعميل) مع علامة واضحة للعودة. */
export const PLATFORM_WINDOW_HREF = "/dashboard?platform=1";
