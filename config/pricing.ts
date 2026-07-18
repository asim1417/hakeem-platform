// ─────────────────────────────────────────────────────────────────────────────
// مصدر الحقيقة الوحيد للأرقام الماليّة/الحصص والخطط — لا رقم مبعثر خارج هذا الملفّ.
// FREE_QUOTA / WARN_AT من البيئة؛ خطط الاشتراك جاهزة للواجهة وقابلة للربط بـ Moyasar لاحقًا.
// ─────────────────────────────────────────────────────────────────────────────

const intEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const PRICING = {
  /** حصّة الاستخدام المجانيّة الممنوحة مرّة عند التسجيل — متغيّرة عبر FREE_QUOTA. */
  freeQuota: intEnv("FREE_QUOTA", 20),
  /** عتبة التنبيه قرب النفاد (يتبقّى ≤ هذا العدد) — متغيّرة عبر WARN_AT. */
  warnAt: intEnv("WARN_AT", 3),
  /** عملة العرض. */
  currency: "SAR" as const,
  currencyLabel: "ر.س",
} as const;

export type Pricing = typeof PRICING;

export type PlanId = "free" | "pro" | "team";

export type PlanInterval = "monthly" | "yearly";

export type PlanDefinition = {
  id: PlanId;
  nameAr: string;
  tagline: string;
  /** سعر شهري بالريال — null = مجاني. */
  monthlySar: number | null;
  /** سعر سنوي بالريال (يُعرض كخصم إن وُجد). */
  yearlySar: number | null;
  /** -1 = غير محدود للمشتركين. */
  advancedUses: number;
  highlighted?: boolean;
  ctaLabel: string;
  /** هل الدفع الحيّ متاح (Moyasar) — false = واجهة جاهزة بلا تحصيل. */
  checkoutEnabled: boolean;
  features: string[];
};

/**
 * كتالوج الخطط — أرقام قابلة للتعديل هنا قبل ربط Moyasar.
 * checkoutEnabled=false حتى تُوفَّر مفاتيح الدفع.
 */
export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    nameAr: "تجربة مجانية",
    tagline: "ابدأ فورًا دون بطاقة دفع",
    monthlySar: null,
    yearlySar: null,
    advancedUses: PRICING.freeQuota,
    ctaLabel: "ابدأ مجانًا",
    checkoutEnabled: false,
    features: [
      `حصّة ${PRICING.freeQuota} استخدامًا للوحدات المتقدّمة`,
      "تصفّح النواة القانونية بلا حد",
      "بحث في الأنظمة والمواد والأحكام",
      "اسأل حكيم · استشارات · قاضي تفاعلي (ضمن الحصّة)",
    ],
  },
  {
    id: "pro",
    nameAr: "محامٍ محترف",
    tagline: "للمحامي الفرد والمكتب الصغير",
    monthlySar: 149,
    yearlySar: 1490,
    advancedUses: -1,
    highlighted: true,
    ctaLabel: "اشترك — قريبًا",
    checkoutEnabled: false,
    features: [
      "استخدام غير محدود للوحدات المتقدّمة",
      "تحليل وقائع ودفوع ومحاكاة قضاء",
      "تصدير المذكرات والاستشارات",
      "أولوية في الدعم الفني",
    ],
  },
  {
    id: "team",
    nameAr: "فريق المكتب",
    tagline: "لمكاتب حتى ١٠ محامين",
    monthlySar: 399,
    yearlySar: 3990,
    advancedUses: -1,
    ctaLabel: "تواصل للمكتب — قريبًا",
    checkoutEnabled: false,
    features: [
      "كل مزايا المحترف",
      "حتى ١٠ مقاعد مستخدمين",
      "إدارة أدوار وصلاحيات الفريق",
      "مساحة عمل مشتركة للقضايا",
    ],
  },
];

export function getPlan(id: PlanId): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}

export function formatSar(amount: number | null): string {
  if (amount === null) return "مجاني";
  return `${amount.toLocaleString("ar-SA")} ${PRICING.currencyLabel}`;
}

/** هل بوابة الدفع مهيّأة؟ (مفاتيح Moyasar لاحقًا). */
export function isCheckoutLive(): boolean {
  const key = (process.env.MOYASAR_SECRET_KEY || process.env.MOYASAR_PUBLISHABLE_KEY || "").trim();
  return Boolean(key) && PLANS.some((p) => p.checkoutEnabled);
}
