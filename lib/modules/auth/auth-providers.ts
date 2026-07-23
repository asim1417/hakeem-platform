/**
 * وسائل الدخول المفعّلة فعليًا للعرض في الواجهة.
 * Apple مخفي افتراضيًا حتى يُفعَّل صراحةً (AUTH_APPLE_ENABLED=1) بعد نجاح الاختبار على الإنتاج.
 */
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isClerkProductionPublishableKey } from "@/lib/modules/auth/owner-emergency";

export function isAppleAuthEnabled(): boolean {
  const flag = (process.env.AUTH_APPLE_ENABLED || process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/** هل تتوفر وسيلة دخول واحدة على الأقل يمكن عرضها؟ */
export function hasAnySignInProvider(): boolean {
  return isGoogleOAuthConfigured() || isClerkConfigured();
}

/**
 * Google يعمل عبر OAuth أصلي (موثوق على iPhone) أو عبر Clerk كاحتياطي.
 * يُفضَّل الأصلي عند توفّر المفاتيح.
 */
export function isGoogleSignInAvailable(): boolean {
  return isGoogleOAuthConfigured() || isClerkConfigured();
}

export function isAppleSignInAvailable(): boolean {
  return isAppleAuthEnabled() && isClerkConfigured();
}

/** جاهزية إطلاق فعلية: Google أصلي أو مفاتيح Clerk إنتاج. */
export function isAuthLaunchReady(): boolean {
  if (isGoogleOAuthConfigured()) return true;
  if (isClerkConfigured() && isClerkProductionPublishableKey()) return true;
  return false;
}

export type VisibleAuthProvider = "google" | "apple";

export function listVisibleAuthProviders(): VisibleAuthProvider[] {
  const out: VisibleAuthProvider[] = [];
  if (isGoogleSignInAvailable()) out.push("google");
  if (isAppleSignInAvailable()) out.push("apple");
  return out;
}
