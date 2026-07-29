/**
 * وحدات الاستخدام المدفوعة/التجريبية.
 * 1000 milli-unit = وحدة واحدة ≈ 1000 توكن موزون.
 *
 * نقاط الولاء القديمة في config/credits.ts تبقى كما هي حتى لا نفقد أرصدة
 * المستخدمين أو نكسر واجهات قائمة. هذه الوحدات هي رصيد استهلاك الخدمات فقط.
 */
export const MILLI_UNITS_PER_UNIT = 1_000;
export const WEIGHTED_TOKENS_PER_UNIT = 1_000;

export const USAGE_REWARDS = {
  verified_contact: 25_000,
  profile_completed: 50_000,
  first_document_indexed: 25_000,
  referral_invitee_qualified: 25_000,
  referral_inviter_qualified: 50_000,
  referral_inviter_first_purchase: 100_000,
} as const;

export type UsageServiceCode =
  | "ASK_HAKEEM"
  | "CONSULTATION"
  | "SIMULATION"
  | "DOCUMENT_UPLOAD"
  | "OCR_PAGE"
  | "OCR_COMPLEX_TABLE"
  | "INDEX_TOKENS"
  | "HYBRID_SEARCH"
  | "RERANK";

export const DEFAULT_USAGE_PRICES: Record<
  UsageServiceCode,
  { milliUnits: number; unitSize: number; pricingModel: string }
> = {
  ASK_HAKEEM: { milliUnits: 1_000, unitSize: 1_000, pricingModel: "TOKEN_WEIGHTED" },
  CONSULTATION: { milliUnits: 1_000, unitSize: 1_000, pricingModel: "TOKEN_WEIGHTED" },
  SIMULATION: { milliUnits: 1_000, unitSize: 1, pricingModel: "FIXED" },
  DOCUMENT_UPLOAD: { milliUnits: 250, unitSize: 1, pricingModel: "FIXED" },
  OCR_PAGE: { milliUnits: 250, unitSize: 1, pricingModel: "PER_PAGE" },
  OCR_COMPLEX_TABLE: { milliUnits: 500, unitSize: 1, pricingModel: "PER_TABLE" },
  INDEX_TOKENS: { milliUnits: 100, unitSize: 1_000, pricingModel: "PER_TOKEN_BLOCK" },
  HYBRID_SEARCH: { milliUnits: 250, unitSize: 1, pricingModel: "FIXED" },
  RERANK: { milliUnits: 250, unitSize: 1, pricingModel: "FIXED" },
};

export function milliUnitsToUnits(value: number | bigint): number {
  return Number(value) / MILLI_UNITS_PER_UNIT;
}

export function calculateUsageCost(
  serviceCode: UsageServiceCode,
  quantity = 1,
  prices = DEFAULT_USAGE_PRICES
): number {
  const price = prices[serviceCode];
  return Math.max(1, Math.ceil(Math.max(0, quantity) / price.unitSize)) * price.milliUnits;
}
