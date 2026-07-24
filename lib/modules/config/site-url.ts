/**
 * أصل الموقع للروابط القانونية (canonical / sitemap / بريد / إحالات).
 * المصدر التشغيلي: NEXT_PUBLIC_SITE_URL (ثم NEXTAUTH_URL).
 * يُقرأ وقت البناء للعميل (NEXT_PUBLIC_) ووقت التشغيل للخادم.
 *
 * ملاحظة: serverActions.allowedOrigins قائمة تراكمية منفصلة في next.config.mjs
 * ولا تُستبدل بهذا المتغير.
 */

/** قيمة احتياط فقط عند غياب المتغير — ليست مصدر الحقيقة للنطاق. */
export const DEFAULT_SITE_URL = "https://hakeem-platform.vercel.app";

function normalizeSiteUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SITE_URL;
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`.replace(/\/+$/, "");
  return trimmed;
}

/** أصل الموقع المطلق بلا شرطة ختامية — للـ canonical والروابط المطلقة فقط. */
export function getSiteUrl(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "").trim();
  return normalizeSiteUrl(fromEnv || DEFAULT_SITE_URL);
}

/** رابط مطلق لمسار داخلي يبدأ بـ /. */
export function absoluteUrl(path = "/"): string {
  const base = getSiteUrl();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

/** مضيف من getSiteUrl() — للعرض/التشخيص؛ ليس قائمة Server Actions. */
export function getSiteHost(): string {
  try {
    return new URL(getSiteUrl()).host;
  } catch {
    return "hakeem-platform.vercel.app";
  }
}
