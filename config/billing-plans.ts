// كتالوج بذر الفوترة — HKM-BILLING-UX-001.
// قيم الأمر التنفيذي كبذور أوّلية قابلة للتعديل من لوحة الإدارة (لا ثوابت موزّعة في الكود).
// الأسعار تُعرض شاملة الضريبة؛ التخزين بالهللات. seed-billing.ts يشتق الصافي/الضريبة.

export type BillingPeriod = "MONTHLY" | "YEARLY";
export type ServicePricingMode = "FIXED" | "TIERED" | "SURCHARGE" | "PER_PAGE" | "PER_TOKEN_BLOCK";

export interface PlanEntitlements {
  services: "all" | string[]; // الخدمات المسموحة
  seats: number;
  fileMaxMb: number; // حد حجم المرفق
  export: boolean; // تصدير Word/PDF
  allowedModel: "sonnet" | "sonnet+opus" | "haiku+sonnet";
  opusPolicy: "none" | "trial" | "surcharge" | "included";
  priority: "normal" | "high" | "highest";
  api: boolean;
  team: boolean;
}

export interface SeedPlan {
  code: string;
  nameAr: string;
  nameEn: string;
  description: string;
  sortOrder: number;
  monthlyPoints: number;
  includedSeats: number;
  /** السعر الشهري الإجمالي شامل الضريبة بالهللات. null = عرض سعر (ENTERPRISE) أو مجاني. */
  monthlyTotalHalalas: number | null;
  /** السعر السنوي الإجمالي شامل الضريبة بالهللات (اختياري). */
  yearlyTotalHalalas?: number | null;
  entitlements: PlanEntitlements;
  isQuoteOnly?: boolean;
}

export const SEED_PLANS: SeedPlan[] = [
  {
    code: "FREE",
    nameAr: "مجاني",
    nameEn: "Free",
    description: "تجربة مجانية — 100 نقطة، مستخدم واحد، بلا بطاقة.",
    sortOrder: 0,
    monthlyPoints: 100,
    includedSeats: 1,
    monthlyTotalHalalas: 0,
    yearlyTotalHalalas: 0,
    entitlements: {
      services: "all",
      seats: 1,
      fileMaxMb: 10,
      export: false,
      allowedModel: "haiku+sonnet",
      opusPolicy: "trial",
      priority: "normal",
      api: false,
      team: false,
    },
  },
  {
    code: "INDIVIDUAL",
    nameAr: "الفرد",
    nameEn: "Individual",
    description: "500 نقطة شهريًا، مستخدم واحد، حفظ الجلسات، تصدير أساسي.",
    sortOrder: 1,
    monthlyPoints: 500,
    includedSeats: 1,
    monthlyTotalHalalas: 4900, // 49.00 ر.س شامل الضريبة
    yearlyTotalHalalas: 49000, // شهرين مجانًا (مثال، قابل للتعديل)
    entitlements: {
      services: "all",
      seats: 1,
      fileMaxMb: 25,
      export: true,
      allowedModel: "haiku+sonnet",
      opusPolicy: "surcharge",
      priority: "normal",
      api: false,
      team: false,
    },
  },
  {
    code: "PROFESSIONAL",
    nameAr: "المحترف",
    nameEn: "Professional",
    description: "2,200 نقطة شهريًا، كل أدوات البحث والصياغة، تحليل مستندات أكبر، أولوية أعلى.",
    sortOrder: 2,
    monthlyPoints: 2200,
    includedSeats: 1,
    monthlyTotalHalalas: 14900, // 149.00
    yearlyTotalHalalas: 149000,
    entitlements: {
      services: "all",
      seats: 1,
      fileMaxMb: 50,
      export: true,
      allowedModel: "sonnet+opus",
      opusPolicy: "surcharge",
      priority: "high",
      api: false,
      team: false,
    },
  },
  {
    code: "OFFICE",
    nameAr: "المكتب",
    nameEn: "Office",
    description: "9,000 نقطة مشتركة شهريًا، 5 مقاعد، مساحة عمل للفريق، تقارير استخدام وتكلفة.",
    sortOrder: 3,
    monthlyPoints: 9000,
    includedSeats: 5,
    monthlyTotalHalalas: 49900, // 499.00
    yearlyTotalHalalas: 499000,
    entitlements: {
      services: "all",
      seats: 5,
      fileMaxMb: 100,
      export: true,
      allowedModel: "sonnet+opus",
      opusPolicy: "surcharge",
      priority: "high",
      api: false,
      team: true,
    },
  },
  {
    code: "ENTERPRISE",
    nameAr: "المؤسسة",
    nameEn: "Enterprise",
    description: "عرض سعر — عدد مقاعد ونقاط متفق عليه، SSO مستقبلًا، حدود مخصصة، فاتورة مؤسسية.",
    sortOrder: 4,
    monthlyPoints: 0,
    includedSeats: 0,
    monthlyTotalHalalas: null,
    yearlyTotalHalalas: null,
    isQuoteOnly: true,
    entitlements: {
      services: "all",
      seats: 0,
      fileMaxMb: 200,
      export: true,
      allowedModel: "sonnet+opus",
      opusPolicy: "included",
      priority: "highest",
      api: true,
      team: true,
    },
  },
];

export interface SeedPackage {
  code: string;
  nameAr: string;
  points: number;
  priceHalalas: number; // شامل الضريبة
  sortOrder: number;
}

export const SEED_PACKAGES: SeedPackage[] = [
  { code: "PACK_250", nameAr: "250 نقطة", points: 250, priceHalalas: 2900, sortOrder: 0 },
  { code: "PACK_700", nameAr: "700 نقطة", points: 700, priceHalalas: 6900, sortOrder: 1 },
  { code: "PACK_1600", nameAr: "1,600 نقطة", points: 1600, priceHalalas: 13900, sortOrder: 2 },
];

export interface SeedServiceRate {
  serviceCode: string;
  displayNameAr: string;
  displayNameEn: string;
  points: number;
  pricingMode: ServicePricingMode;
}

// أسعار الخدمات بالنقاط (§3). milliUnits = points × 1000 عند البذر.
export const SEED_SERVICE_RATES: SeedServiceRate[] = [
  { serviceCode: "ASK_QUICK", displayNameAr: "سؤال سريع", displayNameEn: "Quick Ask", points: 5, pricingMode: "FIXED" },
  { serviceCode: "ASK_SOURCED", displayNameAr: "سؤال مُسنَد", displayNameEn: "Sourced Ask", points: 15, pricingMode: "FIXED" },
  { serviceCode: "ACTION_PLAN", displayNameAr: "خطة عمل", displayNameEn: "Action Plan", points: 20, pricingMode: "FIXED" },
  { serviceCode: "LEGAL_CONSULTATION", displayNameAr: "استشارة قانونية", displayNameEn: "Legal Consultation", points: 30, pricingMode: "FIXED" },
  { serviceCode: "SHORT_DRAFT", displayNameAr: "صياغة قصيرة", displayNameEn: "Short Draft", points: 25, pricingMode: "FIXED" },
  { serviceCode: "ADVANCED_DRAFT", displayNameAr: "صياغة متقدمة", displayNameEn: "Advanced Draft", points: 40, pricingMode: "FIXED" },
  { serviceCode: "VERDICT_ESTIMATE", displayNameAr: "تقدير الحكم", displayNameEn: "Verdict Estimate", points: 35, pricingMode: "FIXED" },
  { serviceCode: "JUDGE_SIMULATION", displayNameAr: "القاضي التفاعلي", displayNameEn: "Judge Simulation", points: 40, pricingMode: "FIXED" },
  { serviceCode: "DOCUMENT_ANALYSIS_BASE", displayNameAr: "تحليل مستند", displayNameEn: "Document Analysis", points: 15, pricingMode: "TIERED" },
  { serviceCode: "DOCUMENT_COMPARISON_BASE", displayNameAr: "مقارنة مستندات", displayNameEn: "Document Comparison", points: 25, pricingMode: "TIERED" },
  { serviceCode: "OPUS_SURCHARGE", displayNameAr: "زيادة النموذج المتقدم", displayNameEn: "Opus Surcharge", points: 25, pricingMode: "SURCHARGE" },
  { serviceCode: "PRO_EXPORT", displayNameAr: "تصدير احترافي", displayNameEn: "Pro Export", points: 5, pricingMode: "FIXED" },
];

export interface SeedModelPrice {
  provider: string;
  model: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  cacheWriteUsdPerMillion: number;
  cacheReadUsdPerMillion: number;
  webSearchUsdPerRequest: number;
}

// أسعار نماذج Claude (§6) — قيم مبدئية تُعدَّل من الإدارة، بالدولار لكل مليون توكن.
export const SEED_MODEL_PRICES: SeedModelPrice[] = [
  { provider: "anthropic", model: "claude-sonnet-4-6", inputUsdPerMillion: 3, outputUsdPerMillion: 15, cacheWriteUsdPerMillion: 3.75, cacheReadUsdPerMillion: 0.3, webSearchUsdPerRequest: 0.01 },
  { provider: "anthropic", model: "claude-opus-4-6", inputUsdPerMillion: 15, outputUsdPerMillion: 75, cacheWriteUsdPerMillion: 18.75, cacheReadUsdPerMillion: 1.5, webSearchUsdPerRequest: 0.01 },
  { provider: "anthropic", model: "claude-3-5-haiku-latest", inputUsdPerMillion: 0.8, outputUsdPerMillion: 4, cacheWriteUsdPerMillion: 1, cacheReadUsdPerMillion: 0.08, webSearchUsdPerRequest: 0.01 },
  { provider: "anthropic", model: "claude-3-5-sonnet-latest", inputUsdPerMillion: 3, outputUsdPerMillion: 15, cacheWriteUsdPerMillion: 3.75, cacheReadUsdPerMillion: 0.3, webSearchUsdPerRequest: 0.01 },
];
