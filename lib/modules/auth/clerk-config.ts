import { arSA } from "@clerk/localizations";
import type { LocalizationResource } from "@clerk/types";

/** هل مفاتيح Clerk مضبوطة؟ بدونه لا يعمل مسار المصادقة الجديد. */
export function isClerkConfigured(): boolean {
  return Boolean(
    (process.env.CLERK_SECRET_KEY || "").trim() &&
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim()
  );
}

/** واجهة Clerk بالعربية + اسم حكيم بدل «My Application». */
export const clerkLocalization: LocalizationResource = {
  ...arSA,
  signIn: {
    ...arSA.signIn,
    start: {
      ...arSA.signIn?.start,
      title: "تسجيل الدخول إلى حكيم",
      subtitle: "مرحبًا بعودتك — منصة المعرفة القضائية",
      subtitleCombined: "مرحبًا بعودتك — منصة المعرفة القضائية",
    },
  },
  signUp: {
    ...arSA.signUp,
    start: {
      ...arSA.signUp?.start,
      title: "إنشاء حساب في حكيم",
      subtitle: "ابدأ مع منصة المعرفة القضائية",
    },
  },
};

/** مظهر Clerk بهوية حكيم (بترولي / نحاسي) — لا الأخضر الافتراضي. */
export const clerkAppearance = {
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
    showOptionalFields: true,
    animations: true,
  },
  variables: {
    colorPrimary: "#0E3435",
    colorBackground: "#F9F5EC",
    colorText: "#0E3435",
    colorTextSecondary: "rgba(14, 52, 53, 0.7)",
    colorInputBackground: "#FFFaf3",
    colorInputText: "#0E3435",
    colorNeutral: "#0E3435",
    borderRadius: "0.5rem",
    fontFamily: "IBM Plex Sans Arabic, Tahoma, sans-serif",
    fontFamilyButtons: "IBM Plex Sans Arabic, Tahoma, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    card: "border border-[#C69763]/30 shadow-none bg-[#F9F5EC]",
    headerTitle: "text-[#0E3435] font-semibold",
    headerSubtitle: "text-[#0E3435]/70",
    socialButtonsBlockButton:
      "border border-[#C69763]/40 bg-[#FFFaf3] text-[#0E3435] hover:bg-[#F3E9D8]",
    formButtonPrimary: "bg-[#0E3435] hover:bg-[#164849] text-[#F9F5EC]",
    formFieldInput: "border-[#C69763]/40 bg-[#FFFaf3] text-[#0E3435]",
    footerActionLink: "text-[#C69763] hover:text-[#0E3435]",
    identityPreviewEditButton: "text-[#C69763]",
    dividerLine: "bg-[#C69763]/30",
    dividerText: "text-[#0E3435]/60",
  },
} as const;
