/**
 * Feature Flag لبوابة الدخول المطوّرة (OAuth-only + رحلة أوضح).
 * الإيقاف الطارئ: AUTH_GATEWAY_UX_V2=0 أو NEXT_PUBLIC_AUTH_GATEWAY_UX_V2=0
 * الافتراضي: مفعّل.
 */
export function isAuthGatewayUxV2Enabled(): boolean {
  const pub = process.env.NEXT_PUBLIC_AUTH_GATEWAY_UX_V2;
  const srv = process.env.AUTH_GATEWAY_UX_V2;
  if (pub === "0" || srv === "0") return false;
  return true;
}
