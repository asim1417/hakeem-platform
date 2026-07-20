/**
 * كتالوج نقاط حكيم — منطق أعمال فوق المصادقة الحالية (بلا Clerk).
 * 1 نقطة ≈ 1 ر.س تقريبًا (تسعير تحفيزي).
 */
export const CREDIT_REWARDS = {
  welcome: 500,
  signup: 100,
  onboarding_step_1: 75,
  onboarding_step_2: 100,
  onboarding_step_3: 150, // OTP جوال
  onboarding_step_4: 100, // اهتمامات
  onboarding_step_5: 50, // صورة/شهادات
  onboarding_step_6: 100, // موافقات
  onboarding_complete: 200,
  referral_signup: 300,
  referral_received: 200,
  /** زيارة كل 3 أيام (مصدر يومي فريد) */
  daily_visit: 25,
  read_article: 10,
  save_ruling: 5,
  helpful_comment: 15,
} as const;

export type CreditSource = keyof typeof CREDIT_REWARDS;

export type CreditSpendId =
  | "download_ruling"
  | "premium_week"
  | "consult_specialist"
  | "premium_month"
  | "premium_year"
  | "advanced_use";

export const CREDIT_SPENDS: Record<
  CreditSpendId,
  { points: number; label: string }
> = {
  download_ruling: { points: 50, label: "تحميل حكم واحد" },
  premium_week: { points: 200, label: "وصول أسبوعي لمقالات مميزة" },
  consult_specialist: { points: 500, label: "استشارة قانونية مع متخصص" },
  premium_month: { points: 1000, label: "اشتراك شهري في المحتوى المميز" },
  premium_year: { points: 5000, label: "اشتراك سنوي + دعم أولوي" },
  /** تجاوز حصّة مجانية مستنفدة لوحدة متقدّمة */
  advanced_use: { points: 25, label: "استخدام وحدة متقدّمة بالنقاط" },
};

/** للتوافق مع الواجهات السابقة */
export const CREDIT_USES = Object.values(CREDIT_SPENDS).map((u) => ({
  points: u.points,
  label: u.label,
}));

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

export function onboardingStepsTotal(): number {
  return (
    CREDIT_REWARDS.onboarding_step_1 +
    CREDIT_REWARDS.onboarding_step_2 +
    CREDIT_REWARDS.onboarding_step_3 +
    CREDIT_REWARDS.onboarding_step_4 +
    CREDIT_REWARDS.onboarding_step_5 +
    CREDIT_REWARDS.onboarding_step_6 +
    CREDIT_REWARDS.onboarding_complete
  );
}
