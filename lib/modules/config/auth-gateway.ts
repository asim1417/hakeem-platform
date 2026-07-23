/**
 * Feature Flag لبوابة الدخول المطوّرة (OAuth-only + رحلة أوضح).
 * الإيقاف الطارئ: NEXT_PUBLIC_AUTH_GATEWAY_UX_V2=0 (أو AUTH_GATEWAY_UX_V2=0 على الخادم)
 * الافتراضي: مفعّل.
 */
export function isAuthGatewayUxV2Enabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_AUTH_GATEWAY_UX_V2;
  if (pub === "0") return false;
  if (pub === "1") return true;
  if (typeof window === "undefined") {
    const srv = process.env.AUTH_GATEWAY_UX_V2;
    if (srv === "0") return false;
  }
  return true;
}
