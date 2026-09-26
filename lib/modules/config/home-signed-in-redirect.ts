/**
 * فصل الواجهة التعريفية عن مساحة العمل: «/» للزائر، و«/dashboard» لصاحب الجلسة.
 *
 * مفتاح الطوارئ: HOME_SIGNED_IN_REDIRECT_ENABLED=0 (Vercel أو الإعدادات المُدارة) يوقف الإحالة.
 * الافتراضي: مفعّل.
 */
export function isHomeSignedInRedirectEnabled(): boolean {
  const v = (process.env.HOME_SIGNED_IN_REDIRECT_ENABLED || "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off");
}

/** ‎/?view=home‎ — الواجهة التعريفية بطلب المستخدم (رابط «عن حكيم») دون إحالة. */
export const HOME_VIEW_PARAM = "view";
export const HOME_VIEW_VALUE = "home";
export const HOME_ABOUT_HREF = `/?${HOME_VIEW_PARAM}=${HOME_VIEW_VALUE}`;

/**
 * علامة قصيرة غير حساسة تُضبط لحظة الضغط على «تسجيل الخروج» (30 ثانية):
 * حذف hakeem_session يتم بطلب لا ينتظره زر خروج Clerk، فتمنع العلامة
 * إعادة المستخدم إلى مساحة العمل إن سبق التحويلُ إلى «/» حذفَ الكوكي.
 */
export const LOGGED_OUT_MARK_COOKIE = "hakeem_logged_out";

export function markLoggedOut() {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOGGED_OUT_MARK_COOKIE}=1; Path=/; Max-Age=30; SameSite=Lax${secure}`;
}

export function shouldRedirectSignedInHome(opts: {
  enabled: boolean;
  hasSession: boolean;
  view?: string | string[] | null;
  justLoggedOut: boolean;
}): boolean {
  if (!opts.enabled || !opts.hasSession || opts.justLoggedOut) return false;
  const view = Array.isArray(opts.view) ? opts.view[0] : opts.view;
  return view !== HOME_VIEW_VALUE;
}
