/**
 * كتالوج نقاط حكيم — منطق أعمال فوق المصادقة الحالية (بلا Clerk).
 * 1 نقطة ≈ 1 ر.س تقريبًا (تسعير تحفيزي، ليس وسيلة دفع بعد).
 */
export const CREDIT_REWARDS = {
  /** رصيد ترحيبي عند إنشاء الحساب */
  welcome: 500,
  /** مكافأة التسجيل الأساسي */
  signup: 100,
  onboarding_step_1: 75, // بيانات أساسية
  onboarding_step_2: 100, // خلفية مهنية
  onboarding_step_3: 150, // تأكيد الهاتف (بدون OTP خارجي حاليًا)
  onboarding_step_4: 100, // اهتمامات وتنبيهات
  onboarding_step_5: 100, // موافقات وإكمال
  onboarding_complete: 200, // إكمال كل الحقول
  referral_signup: 300, // للمُحيل
  referral_received: 200, // للمُحال
} as const;

export type CreditSource = keyof typeof CREDIT_REWARDS;

export const CREDIT_USES = [
  { points: 50, label: "تحميل حكم واحد" },
  { points: 200, label: "وصول أسبوعي لمقالات مميزة" },
  { points: 500, label: "استشارة قانونية مع متخصص" },
  { points: 1000, label: "اشتراك شهري في المحتوى المميز" },
  { points: 5000, label: "اشتراك سنوي + دعم أولوي" },
] as const;

export const SPECIALTY_OPTIONS = [
  "تجاري",
  "عمالي",
  "مدني",
  "جزائي",
  "أحوال شخصية",
  "إداري",
  "عقاري",
  "مصرفي ومالي",
  "ملكية فكرية",
  "تحكيم",
] as const;

export const CITY_OPTIONS = [
  "الرياض",
  "جدة",
  "مكة المكرمة",
  "المدينة المنورة",
  "الدمام",
  "الخبر",
  "الظهران",
  "الطائف",
  "تبوك",
  "أبها",
  "حائل",
  "نجران",
  "جازان",
  "القصيم",
  "الجبيل",
  "ينبع",
  "أخرى",
] as const;

export const YEARS_OPTIONS = [
  { value: "0-1", label: "أقل من سنة" },
  { value: "1-3", label: "1–3 سنوات" },
  { value: "3-7", label: "3–7 سنوات" },
  { value: "7-15", label: "7–15 سنة" },
  { value: "15+", label: "أكثر من 15 سنة" },
] as const;

/** مجموع نقاط onboarding الأساسية (بدون ترحيب/تسجيل). */
export function onboardingStepsTotal(): number {
  return (
    CREDIT_REWARDS.onboarding_step_1 +
    CREDIT_REWARDS.onboarding_step_2 +
    CREDIT_REWARDS.onboarding_step_3 +
    CREDIT_REWARDS.onboarding_step_4 +
    CREDIT_REWARDS.onboarding_step_5 +
    CREDIT_REWARDS.onboarding_complete
  );
}
