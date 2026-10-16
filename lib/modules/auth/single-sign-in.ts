/**
 * صفحة دخول واحدة — ‎/sign-in‎. بقية المداخل تُحال إليها في الـ middleware (307 قبل أي رسم؛
 * redirect() داخل الصفحة يصير انتقالًا من العميل بسبب app/loading.tsx).
 * مفتاح الطوارئ HOME_INLINE_AUTH_ENABLED=0 يوقف الإحالة ويعيد الصفحات السابقة.
 */
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

const SIGN_UP_ENTRIES = [/^\/sign-up(?:\/.*)?$/, /^\/register\/?$/];
const SIGN_IN_ENTRIES = [/^\/login\/?$/, /^\/auth\/identifier\/?$/];

/** ‎/sign-in?…‎ لمدخل قديم، أو null إن لم يكن مدخلًا يُحال. */
export function singleSignInTarget(pathname: string, search: URLSearchParams): string | null {
  const signUp = SIGN_UP_ENTRIES.some((r) => r.test(pathname));
  if (!signUp && !SIGN_IN_ENTRIES.some((r) => r.test(pathname))) return null;
  const params = new URLSearchParams();
  if (signUp || search.get("mode") === "sign-up") params.set("mode", "sign-up");
  const next = search.get("next") || search.get("returnUrl");
  if (next) params.set("next", safeDashboardNext(next));
  const qs = params.toString();
  return `/sign-in${qs ? `?${qs}` : ""}`;
}
