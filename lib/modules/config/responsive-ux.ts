/**
 * راية واجهة التوافق الجوّال / التنقل الموحّد.
 * الإيقاف الطارئ: RESPONSIVE_UX_V2=0 أو NEXT_PUBLIC_RESPONSIVE_UX_V2=0
 */
export function isResponsiveUxV2Enabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_RESPONSIVE_UX_V2;
  const srv = process.env.RESPONSIVE_UX_V2;
  if (pub === "0" || srv === "0") return false;
  if (pub === "1" || srv === "1") return true;
  return true; // افتراضيًا مفعّل
}
