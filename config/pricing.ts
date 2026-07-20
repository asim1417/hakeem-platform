// ─────────────────────────────────────────────────────────────────────────────
// مصدر الحقيقة الوحيد للأرقام الماليّة/الحصص والخطط — لا رقم مبعثر خارج هذا الملفّ.
// FREE_QUOTA / WARN_AT من البيئة؛ خطط الاشتراك + Moyasar عند توفر المفتاح.
// ─────────────────────────────────────────────────────────────────────────────

const intEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export const PRICING = {
  freeQuota: intEnv("FREE_QUOTA", 20),
  warnAt: intEnv("WARN_AT", 3),
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
  monthlySar: number | null;
  yearlySar: number | null;
  advancedUses: number;
  highlighted?: boolean;
  ctaLabel: string;
  /** يُحدَّث وقت التشغيل عبر withLiveCheckout */
  checkoutEnabled: boolean;
  features: string[];
};

const BASE_PLANS: PlanDefinition[] = [
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
    ctaLabel: "اشترك الآن",
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
    ctaLabel: "اشترك للمكتب",
    checkoutEnabled: false,
    features: [
      "كل مزايا المحترف",
      "حتى ١٠ مقاعد مستخدمين",
      "إدارة أدوار وصلاحيات الفريق",
      "مساحة عمل مشتركة للقضايا",
    ],
  },
];

/** هل بوابة الدفع مهيّأة؟ */
export function isCheckoutLive(): boolean {
  return Boolean((process.env.MOYASAR_SECRET_KEY || "").trim());
}

/** كتالوج الخطط مع تفعيل checkout عند وجود مفتاح Moyasar. */
export function getPlans(): PlanDefinition[] {
  const live = isCheckoutLive();
  return BASE_PLANS.map((p) => ({
    ...p,
    checkoutEnabled: live && p.id !== "free",
    ctaLabel:
      p.id === "free"
        ? p.ctaLabel
        : live
          ? p.id === "pro"
            ? "اشترك عبر Moyasar"
            : "اشترك للمكتب"
          : "اشترك — قريبًا (اضبط Moyasar)",
  }));
}

/** للتوافق مع الاستيرادات السابقة */
export const PLANS: PlanDefinition[] = getPlans();

export function getPlan(id: PlanId): PlanDefinition | undefined {
  return getPlans().find((p) => p.id === id);
}

export function formatSar(amount: number | null): string {
  if (amount === null) return "مجاني";
  return `${amount.toLocaleString("ar-SA")} ${PRICING.currencyLabel}`;
}
