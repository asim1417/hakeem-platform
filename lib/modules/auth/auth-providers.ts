/**
 * وسائل الدخول المفعّلة فعليًا للعرض في الواجهة.
 *
 * كل وسيلة غير Google مخفية افتراضيًا حتى تُفعَّل في لوحة Clerk أولًا ثم يُضبط علمها هنا —
 * يمنع ظهور زر يقود إلى استراتيجية معطّلة في Clerk:
 *   AUTH_APPLE_ENABLED        ← Apple (Sign in with Apple)
 *   AUTH_MICROSOFT_ENABLED    ← Microsoft (Outlook / Microsoft 365 / Entra ID)
 *   AUTH_EMAIL_CODE_ENABLED   ← البريد الإلكتروني برمز تحقق
 *   AUTH_PHONE_ENABLED        ← رقم الجوال برمز OTP (SMS)
 *   AUTH_MFA_ENABLED          ← إظهار إعداد التحقق الثنائي في قائمة الحساب
 *   AUTH_ORGANIZATIONS_ENABLED ← إظهار حسابات المكاتب (Organizations) في قائمة الحساب
 * كل علم يقبل أيضًا نظيره NEXT_PUBLIC_*.
 */
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isClerkProductionPublishableKey } from "@/lib/modules/auth/owner-emergency";

export const AUTH_FEATURE_FLAGS = [
  "AUTH_APPLE_ENABLED",
  "AUTH_MICROSOFT_ENABLED",
  "AUTH_EMAIL_CODE_ENABLED",
  "AUTH_PHONE_ENABLED",
  "AUTH_MFA_ENABLED",
  "AUTH_ORGANIZATIONS_ENABLED",
] as const;

export type AuthFeatureFlag = (typeof AUTH_FEATURE_FLAGS)[number];

export function isAuthFlagEnabled(flag: AuthFeatureFlag): boolean {
  const raw = (process.env[flag] || process.env[`NEXT_PUBLIC_${flag}`] || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isAppleAuthEnabled(): boolean {
  return isAuthFlagEnabled("AUTH_APPLE_ENABLED");
}

/** هل تتوفر وسيلة دخول واحدة على الأقل يمكن عرضها؟ */
export function hasAnySignInProvider(): boolean {
  return isGoogleOAuthConfigured() || isClerkConfigured();
}

/**
 * Google يعمل عبر OAuth أصلي (موثوق على iPhone) أو عبر Clerk كاحتياطي.
 * يُفضَّل الأصلي عند توفّر المفاتيح.
 */
export function isGoogleSignInAvailable(): boolean {
  return isGoogleOAuthConfigured() || isClerkConfigured();
}

export function isAppleSignInAvailable(): boolean {
  return isAppleAuthEnabled() && isClerkConfigured();
}

/** Microsoft عبر Clerk (oauth_microsoft) — مسار Entra اليدوي القديم مُلغى. */
export function isMicrosoftSignInAvailable(): boolean {
  return isAuthFlagEnabled("AUTH_MICROSOFT_ENABLED") && isClerkConfigured();
}

export function isEmailCodeSignInAvailable(): boolean {
  return isAuthFlagEnabled("AUTH_EMAIL_CODE_ENABLED") && isClerkConfigured();
}

export function isPhoneSignInAvailable(): boolean {
  return isAuthFlagEnabled("AUTH_PHONE_ENABLED") && isClerkConfigured();
}

/** جاهزية إطلاق فعلية: Google أصلي أو مفاتيح Clerk إنتاج. */
export function isAuthLaunchReady(): boolean {
  if (isGoogleOAuthConfigured()) return true;
  if (isClerkConfigured() && isClerkProductionPublishableKey()) return true;
  return false;
}

export type VisibleAuthProvider = "google" | "apple" | "microsoft" | "email" | "phone";

/** بالترتيب المعروض: الحسابات الاجتماعية أولًا ثم البريد والجوال. */
export function listVisibleAuthProviders(): VisibleAuthProvider[] {
  const out: VisibleAuthProvider[] = [];
  if (isGoogleSignInAvailable()) out.push("google");
  if (isMicrosoftSignInAvailable()) out.push("microsoft");
  if (isAppleSignInAvailable()) out.push("apple");
  if (isEmailCodeSignInAvailable()) out.push("email");
  if (isPhoneSignInAvailable()) out.push("phone");
  return out;
}

export type AccountSecurityFeatures = {
  /** رابط إعداد التحقق الثنائي (تطبيق المصادقة / رموز احتياطية) */
  mfa: boolean;
  /** حسابات المكاتب: إنشاء مكتب ودعوة الأعضاء */
  organizations: boolean;
};

/** ميزات إدارة الحساب المعروضة في قائمة الحساب — تُدار كلها من بوابة حسابات Clerk. */
export function getAccountSecurityFeatures(): AccountSecurityFeatures {
  const clerk = isClerkConfigured();
  return {
    mfa: clerk && isAuthFlagEnabled("AUTH_MFA_ENABLED"),
    organizations: clerk && isAuthFlagEnabled("AUTH_ORGANIZATIONS_ENABLED"),
  };
}
