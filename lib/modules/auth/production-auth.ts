/**
 * سياسة مصادقة الإنتاج:
 * 1) Google الأصلي (GOOGLE_CLIENT_ID/SECRET) هو المسار المفضّل للعامة.
 * 2) Clerk على النطاق الحيّ يجب أن يكون pk_live_ / sk_live_ — لا pk_test_.
 * 3) لا نسقط بصمت إلى Clerk Development على الإنتاج.
 */
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import {
  isClerkProductionPublishableKey,
  isClerkProductionSecretKey,
  isProductionRuntime,
} from "@/lib/modules/auth/owner-emergency";
import { decodeClerkFrontendApiHost } from "@/lib/modules/auth/clerk-oauth-start";

export type GoogleAuthMode = "native" | "clerk_fallback" | "unavailable";
export type ClerkInstanceKind = "live" | "test" | "missing";

export function getClerkInstanceKind(): ClerkInstanceKind {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  if (!pk) return "missing";
  if (pk.startsWith("pk_live_")) return "live";
  if (pk.startsWith("pk_test_")) return "test";
  return "missing";
}

/** مضيف Clerk Frontend API بدون أسرار (مثل safe-elk-50.clerk.accounts.dev). */
export function getClerkFrontendHost(): string | null {
  const pk = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  return decodeClerkFrontendApiHost(pk);
}

export function getGoogleAuthMode(): GoogleAuthMode {
  if (isGoogleOAuthConfigured()) return "native";
  if (isClerkConfigured()) return "clerk_fallback";
  return "unavailable";
}

/**
 * هل يُسمح بالسقوط إلى Clerk لدخول Google؟
 * على الإنتاج: فقط مع مفاتيح live. على التطوير/المعاينة: مسموح.
 */
export function allowClerkGoogleFallback(): boolean {
  if (!isClerkConfigured()) return false;
  if (!isProductionRuntime()) return true;
  return isClerkProductionPublishableKey() && isClerkProductionSecretKey();
}

/** جاهزية دخول الإنتاج للعامة (بدون أسرار). */
export function isAuthProductionReady(): boolean {
  if (isGoogleOAuthConfigured()) return true;
  if (!isProductionRuntime()) {
    return isClerkConfigured() || isGoogleOAuthConfigured();
  }
  return (
    isClerkConfigured() &&
    isClerkProductionPublishableKey() &&
    isClerkProductionSecretKey()
  );
}

export type AuthProductionStatus = {
  productionRuntime: boolean;
  googleMode: GoogleAuthMode;
  googleNative: boolean;
  clerkConfigured: boolean;
  clerkInstance: ClerkInstanceKind;
  clerkFrontendHost: string | null;
  clerkLiveKeys: boolean;
  allowClerkFallback: boolean;
  ready: boolean;
  recommendation: string;
};

export function getAuthProductionStatus(): AuthProductionStatus {
  const googleNative = isGoogleOAuthConfigured();
  const clerkConfigured = isClerkConfigured();
  const clerkInstance = getClerkInstanceKind();
  const clerkLiveKeys =
    isClerkProductionPublishableKey() && isClerkProductionSecretKey();
  const productionRuntime = isProductionRuntime();
  const allowClerkFallback = allowClerkGoogleFallback();
  const ready = isAuthProductionReady();

  let recommendation: string;
  if (googleNative) {
    recommendation =
      "المسار الأمثل فعّال: دخول Google الأصلي مباشرة دون Clerk.";
  } else if (productionRuntime && clerkInstance === "test") {
    recommendation =
      "ضبط GOOGLE_CLIENT_ID/SECRET للمسار الأصلي، أو ترقية Clerk إلى Instance Production (pk_live_/sk_live_). لا تعتمد على pk_test_ على النطاق الحي.";
  } else if (productionRuntime && !clerkConfigured && !googleNative) {
    recommendation =
      "لا وسيلة دخول جاهزة للإنتاج. أضف مفاتيح Google الأصلية فورًا.";
  } else if (!googleNative && clerkConfigured && clerkLiveKeys) {
    recommendation =
      "Clerk إنتاج جاهز كاحتياطي. يُفضَّل إضافة Google الأصلي لاستقرار أعلى على iPhone/Safari.";
  } else {
    recommendation =
      "بيئة تطوير: يمكن استخدام Clerk test أو Google. قبل الإطلاق العام فعّل Google الأصلي أو Clerk live.";
  }

  return {
    productionRuntime,
    googleMode: getGoogleAuthMode(),
    googleNative,
    clerkConfigured,
    clerkInstance,
    clerkFrontendHost: getClerkFrontendHost(),
    clerkLiveKeys,
    allowClerkFallback,
    ready,
    recommendation,
  };
}
