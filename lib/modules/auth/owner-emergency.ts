/**
 * بوابة دخول المالك الطارئة — غير مرتبطة بالواجهة العامة.
 *
 * التفعيل يتطلّب صراحةً:
 *   OWNER_EMERGENCY_LOGIN_ENABLED=true
 *
 * في بيئة الإنتاج (VERCEL_ENV=production أو NODE_ENV=production مع Vercel):
 *   يلزم أيضًا OWNER_EMERGENCY_ALLOW_PRODUCTION=true
 *
 * المسار العام: /internal/owner-gate (غير مدرج في القوائم).
 */
export function isOwnerEmergencyLoginEnabled(): boolean {
  const flag = (process.env.OWNER_EMERGENCY_LOGIN_ENABLED || "").trim().toLowerCase();
  if (flag !== "1" && flag !== "true" && flag !== "yes") return false;

  if (isProductionRuntime()) {
    const allowProd = (process.env.OWNER_EMERGENCY_ALLOW_PRODUCTION || "").trim().toLowerCase();
    return allowProd === "1" || allowProd === "true" || allowProd === "yes";
  }
  return true;
}

/** تشغيل إنتاجي على Vercel أو NODE_ENV=production. */
export function isProductionRuntime(): boolean {
  const vercel = (process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercel === "production") return true;
  if (vercel === "preview" || vercel === "development") return false;
  return (process.env.NODE_ENV || "").trim() === "production";
}

/** هل مفتاح Clerk العام من بيئة Production (pk_live_)؟ */
export function isClerkProductionPublishableKey(key?: string): boolean {
  const pk = (key ?? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "").trim();
  return pk.startsWith("pk_live_");
}

/** هل المفتاح سرّي من بيئة Production (sk_live_)؟ */
export function isClerkProductionSecretKey(key?: string): boolean {
  const sk = (key ?? process.env.CLERK_SECRET_KEY ?? "").trim();
  return sk.startsWith("sk_live_");
}

/**
 * في النشر الفعلي: أخفِ شارة Development mode من واجهة Clerk
 * (خصوصًا إن بقيت مفاتيح pk_test_ مؤقتًا على نطاق Vercel).
 * المفتاح الصحيح طويل الأمد: pk_live_ / sk_live_ بعد نطاق مخصّص.
 */
export function shouldHideClerkDevelopmentModeUi(): boolean {
  if (isClerkProductionPublishableKey()) return true;
  return isProductionRuntime();
}
