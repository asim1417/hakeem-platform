/**
 * أصل الموقع للروابط القانونية (canonical / sitemap / robots / بريد / إحالات).
 * المصدر التشغيلي: NEXT_PUBLIC_SITE_URL (ثم NEXTAUTH_URL)، وإلا DEFAULT_SITE_URL.
 * يُقرأ وقت البناء للعميل (NEXT_PUBLIC_) ووقت التشغيل للخادم.
 *
 * HKM-061: نطاقات Vercel المؤقتة (*.vercel.app) لا تكون أصلًا عامًا للموقع أبدًا؛ القيمة
 * التي تشير إليها تُتجاوز كأنها غير مضبوطة، فلا يعود canonical/sitemap/robots إلى
 * hakeem-platform.vercel.app حتى لو بقي متغير البيئة القديم في Vercel.
 *
 * هذا الأصل للروابط المطلقة المعروضة فقط. روابط الرجوع في الدخول (Clerk/Google) وOAuth الخاص
 * بـ MCP تُبنى من أصل الطلب نفسه (request.nextUrl.origin / publicOrigin) لا من هنا،
 * فيبقى الدخول عبر hakeem-platform.vercel.app يعمل كما هو.
 *
 * ملاحظة: serverActions.allowedOrigins قائمة تراكمية منفصلة في next.config.mjs
 * ولا تُستبدل بهذا المتغير.
 */

/** قيمة احتياط فقط عند غياب المتغير (أو إشارته إلى vercel.app) — ليست مصدر الحقيقة للنطاق. */
export const DEFAULT_SITE_URL = "https://hakeemai.net";

/** مضيف نشر Vercel المؤقت (الإنتاج القديم أو المعاينات): لا يصلح أصلًا عامًا. */
export function isVercelDeploymentHost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  return h === "vercel.app" || h.endsWith(".vercel.app");
}

/** يطبّع قيمة متغير إلى أصل مطلق بلا شرطة ختامية، أو null إن كانت فارغة/غير صالحة/على vercel.app. */
function normalizeCandidate(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  // البروتوكول يُفحص قبل حذف الشرطات الختامية، فلا تصير «https://» وحدها «https://https:».
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let host: string;
  try {
    host = new URL(withProto).host;
  } catch {
    return null;
  }
  if (!host || isVercelDeploymentHost(host)) return null;
  return withProto.replace(/\/+$/, "");
}

/**
 * أول مرشح صالح بالترتيب؛ ما كان فارغًا أو غير صالح أو على *.vercel.app يُتجاوز.
 * دالة صرفة للاختبار؛ getSiteUrl() تمرّر لها متغيرات البيئة.
 */
export function resolveSiteUrl(candidates: ReadonlyArray<string | null | undefined>): string {
  for (const c of candidates) {
    const v = normalizeCandidate(c);
    if (v) return v;
  }
  return DEFAULT_SITE_URL;
}

/** أصل الموقع المطلق بلا شرطة ختامية — للـ canonical والروابط المطلقة فقط. */
export function getSiteUrl(): string {
  // الوصول الحرفي إلى process.env.NEXT_PUBLIC_SITE_URL لازم ليُخبَز في حزمة العميل.
  return resolveSiteUrl([process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL]);
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
    return "hakeemai.net";
  }
}
