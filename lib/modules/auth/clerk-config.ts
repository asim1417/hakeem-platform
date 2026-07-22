import { arSA } from "@clerk/localizations";
import type { LocalizationResource } from "@clerk/types";
import { shouldHideClerkDevelopmentModeUi } from "@/lib/modules/auth/owner-emergency";

/** هل مفاتيح Clerk مضبوطة؟ بدونه لا يعمل مسار المصادقة الجديد. */
export function isClerkConfigured(): boolean {
  return Boolean(
    (process.env.CLERK_SECRET_KEY || "").trim() &&
      (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim()
  );
}

/** واجهة Clerk بالعربية + نصوص حكيم المعتمدة. */
export const clerkLocalization: LocalizationResource = {
  ...arSA,
  signIn: {
    ...arSA.signIn,
    start: {
      ...arSA.signIn?.start,
      title: "مرحبًا بعودتك إلى حكيم",
      subtitle: "سجّل الدخول لمتابعة أعمالك القانونية",
      subtitleCombined: "سجّل الدخول لمتابعة أعمالك القانونية",
      actionText: "مستخدم جديد؟",
      actionLink: "أنشئ حسابك",
    },
  },
  signUp: {
    ...arSA.signUp,
    start: {
      ...arSA.signUp?.start,
      title: "إنشاء حساب في حكيم",
      subtitle: "ابدأ مع منصة المعرفة القضائية",
      actionText: "لديك حساب؟",
      actionLink: "تسجيل الدخول",
    },
  },
  formFieldLabel__emailAddress_username: "البريد الإلكتروني أو اسم المستخدم",
  formFieldLabel__emailAddress: "البريد الإلكتروني",
  formFieldLabel__username: "اسم المستخدم",
  formFieldInputPlaceholder__emailAddress_username: "أدخل بريدك الإلكتروني أو اسم المستخدم",
  formFieldInputPlaceholder__emailAddress: "أدخل بريدك الإلكتروني",
  formFieldInputPlaceholder__username: "أدخل اسم المستخدم",
  formButtonPrimary: "متابعة",
  dividerText: "أو",
  socialButtonsBlockButton: "المتابعة باستخدام {{provider|titleize}}",
  socialButtonsBlockButtonManyInView: "{{provider|titleize}}",
  unstable__errors: {
    ...arSA.unstable__errors,
    form_identifier_not_found: "تعذّر إكمال الدخول. تحقّق من البيانات وحاول مرة أخرى.",
    form_password_incorrect: "تعذّر إكمال الدخول. تحقّق من البيانات وحاول مرة أخرى.",
    form_param_nil: "يرجى تعبئة الحقل المطلوب.",
    form_param_format_invalid: "صيغة المدخل غير صحيحة.",
    form_param_format_invalid__email_address: "صيغة البريد الإلكتروني غير صحيحة.",
    form_username_invalid_length:
      "يجب أن يكون اسم المستخدم بين {{min_length}} و{{max_length}} حرفًا.",
    form_username_invalid_character: "اسم المستخدم يحتوي على أحرف غير مسموحة.",
    form_password_length_too_short:
      "كلمة المرور قصيرة جدًا. يجب أن تكون 8 أحرف على الأقل.",
    form_param_format_invalid__phone_number: "صيغة رقم الجوال غير صحيحة.",
    form_param_type_invalid__phone_number: "رقم الجوال غير صالح.",
    form_new_password_matches_current: "كلمة المرور الجديدة لا يجوز أن تطابق الحالية.",
    not_allowed_access: "غير مسموح بالتسجيل بهذا المعرّف. راجع إعدادات الحساب أو تواصل مع الدعم.",
    identification_deletion_failed: "تعذّر إكمال العملية. حاول مرة أخرى.",
    form_code_incorrect: "رمز التحقق غير صحيح.",
    form_identifier_exists__email_address: "تعذّر إكمال التسجيل بهذا البريد. جرّب تسجيل الدخول.",
    form_identifier_exists__username: "تعذّر إكمال التسجيل باسم المستخدم هذا. جرّب تسجيل الدخول.",
  },
};

function buildClerkAppearance() {
  const hideDev = shouldHideClerkDevelopmentModeUi();
  return {
    layout: {
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
      showOptionalFields: true,
      animations: true,
      termsPageUrl: "/terms",
      privacyPageUrl: "/privacy",
      ...(hideDev ? { unsafe_disableDevelopmentModeWarnings: true } : {}),
    },
    variables: {
      colorPrimary: "#0E3435",
      colorBackground: "#FFFcf7",
      colorText: "#0E3435",
      colorTextSecondary: "rgba(14, 52, 53, 0.68)",
      colorInputBackground: "#FFFFFF",
      colorInputText: "#0E3435",
      colorNeutral: "#0E3435",
      colorDanger: "#B42318",
      borderRadius: "0.75rem",
      fontFamily: "IBM Plex Sans Arabic, Tahoma, sans-serif",
      fontFamilyButtons: "IBM Plex Sans Arabic, Tahoma, sans-serif",
      fontSize: "1rem",
    },
    elements: {
      rootBox: "w-full auth-clerk-root",
      card: "auth-clerk-card border border-[rgba(14,52,53,0.08)] shadow-[0_8px_30px_rgba(14,52,53,0.06)] bg-[#FFFcf7]",
      headerTitle: "text-[#0E3435] font-semibold text-[1.35rem] leading-8",
      headerSubtitle: "text-[rgba(14,52,53,0.68)] text-[0.95rem] leading-7",
      socialButtons: "auth-clerk-social gap-2",
      socialButtonsBlockButton:
        "auth-clerk-sso min-h-[48px] border border-[rgba(14,52,53,0.12)] bg-white text-[#0E3435] hover:bg-[#F7F2EA] focus-visible:ring-2 focus-visible:ring-[#0E3435]/35",
      socialButtonsBlockButtonText: "text-[0.95rem] font-semibold",
      socialButtonsProviderIcon: "auth-clerk-sso-icon",
      formButtonPrimary:
        "auth-clerk-primary min-h-[48px] justify-center bg-[#0E3435] hover:bg-[#164849] active:bg-[#0A2829] disabled:opacity-55 disabled:cursor-not-allowed text-[#FFFcf7] text-[0.95rem] font-semibold shadow-none",
      formButtonPrimary__loading: "auth-clerk-primary-loading",
      formFieldLabel: "text-[#0E3435] text-sm font-semibold",
      formFieldInput:
        "auth-clerk-input min-h-[48px] text-[16px] border-[rgba(14,52,53,0.14)] bg-white text-[#0E3435] focus:border-[#0E3435] focus:ring-2 focus:ring-[#0E3435]/20",
      formFieldErrorText: "text-[#B42318] text-sm leading-6",
      formFieldSuccessText: "text-[#0E3435]/70 text-sm",
      footerActionLink: "text-[#8B6914] hover:text-[#0E3435] font-semibold",
      footerActionText: "text-[rgba(14,52,53,0.6)]",
      identityPreviewEditButton: "text-[#8B6914]",
      dividerLine: "bg-[rgba(14,52,53,0.12)]",
      dividerText: "text-[rgba(14,52,53,0.55)] text-sm",
      footer: "auth-clerk-footer",
      footerPages: "auth-clerk-footer-pages gap-3",
      footerPagesLink: "text-[rgba(14,52,53,0.55)] hover:text-[#0E3435] text-xs",
      badge: "auth-clerk-badge",
      spinner: "border-[#0E3435]/30 border-t-[#0E3435]",
    },
  } as const;
}

/** مظهر Clerk بهوية حكيم — هادئ وفاخر، بلا زخرفة زائدة. */
export const clerkAppearance = buildClerkAppearance();
