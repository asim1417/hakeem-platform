/**
 * راية واجهة التوافق الجوّال / التنقل الموحّد.
 * الإيقاف الطارئ: NEXT_PUBLIC_RESPONSIVE_UX_V2=0 (أو RESPONSIVE_UX_V2=0 على الخادم فقط)
 */
export function isResponsiveUxV2Enabled(): boolean {
  // على العميل لا نقرأ إلا NEXT_PUBLIC_ لتفادي أعطال process.env غير المضمّنة
  const pub = process.env.NEXT_PUBLIC_RESPONSIVE_UX_V2;
  if (pub === "0") return false;
  if (pub === "1") return true;
  if (typeof window === "undefined") {
    const srv = process.env.RESPONSIVE_UX_V2;
    if (srv === "0") return false;
    if (srv === "1") return true;
  }
  return true;
}
