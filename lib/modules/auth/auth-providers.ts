/**
 * وسائل الدخول الظاهرة فعليًا في الواجهة العامة.
 * لا تُعرض وسيلة غير مهيأة: Apple / Microsoft العام / الهاتف أعلام معطّلة افتراضيًا.
 * Microsoft Entra اليدوي ليس بوابة عامة — يتطلب قرارًا مؤسسيًا صريحًا.
 */
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isClerkProductionPublishableKey } from "@/lib/modules/auth/owner-emergency";

function envFlagOn(...keys: string[]): boolean {
  for (const key of keys) {
    const flag = (process.env[key] || "").trim().toLowerCase();
    if (flag === "1" || flag === "true" || flag === "yes") return true;
  }
  return false;
}

/** Apple — عام فقط بعد AUTH_APPLE_ENABLED=1 واختبار إنتاج. */
export function isAppleAuthEnabled(): boolean {
  return envFlagOn("AUTH_APPLE_ENABLED", "NEXT_PUBLIC_AUTH_APPLE_ENABLED");
}

/**
 * Microsoft Social العام عبر Clerk — معطّل افتراضيًا.
 * لا يخلط مع Entra SSO المؤسسي (AZURE_AD_*) الذي يبقى خارج الواجهة العامة.
 */
export function isMicrosoftPublicAuthEnabled(): boolean {
  return envFlagOn("AUTH_MICROSOFT_PUBLIC_ENABLED", "NEXT_PUBLIC_AUTH_MICROSOFT_PUBLIC_ENABLED");
}

/** الهاتف / SMS عبر Clerk — معطّل افتراضيًا حتى خطة مؤهّلة وحدود إرسال. */
export function isPhoneAuthEnabled(): boolean {
  return envFlagOn("AUTH_PHONE_ENABLED", "NEXT_PUBLIC_AUTH_PHONE_ENABLED");
}

/** Magic link — بقايا قديمة؛ لا يُفعَّل للعامة إلا بقرار صريح. */
export function isMagicLinkPublicEnabled(): boolean {
  return envFlagOn("AUTH_MAGIC_LINK_PUBLIC_ENABLED");
}

/** هل تتوفر وسيلة دخول عامة واحدة على الأقل؟ */
export function hasAnySignInProvider(): boolean {
  return isGoogleOAuthConfigured() || isClerkConfigured();
}

/**
 * Google: OAuth أصلي (موثوق على iPhone) أو Clerk كاحتياطي.
 * يُفضَّل الأصلي عند توفّر المفاتيح.
 */
export function isGoogleSignInAvailable(): boolean {
  return isGoogleOAuthConfigured() || isClerkConfigured();
}

export function isAppleSignInAvailable(): boolean {
  return isAppleAuthEnabled() && isClerkConfigured();
}

export function isMicrosoftPublicSignInAvailable(): boolean {
  return isMicrosoftPublicAuthEnabled() && isClerkConfigured();
}

export function isPhoneSignInAvailable(): boolean {
  return isPhoneAuthEnabled() && isClerkConfigured();
}

/** جاهزية إطلاق فعلية: Google أصلي أو مفاتيح Clerk إنتاج (pk_live_). */
export function isAuthLaunchReady(): boolean {
  if (isGoogleOAuthConfigured()) return true;
  if (isClerkConfigured() && isClerkProductionPublishableKey()) return true;
  return false;
}

export { isAuthProductionReady, getAuthProductionStatus } from "@/lib/modules/auth/production-auth";

export type VisibleAuthProvider = "google" | "apple";

export function listVisibleAuthProviders(): VisibleAuthProvider[] {
  const out: VisibleAuthProvider[] = [];
  if (isGoogleSignInAvailable()) out.push("google");
  if (isAppleSignInAvailable()) out.push("apple");
  return out;
}
