// تجريد مزود الدفع — HKM-BILLING-UX-001 (§7). مزوّد قابل للاستبدال.
// منطق الاشتراكات/الطلبات لا يعتمد على Moyasar مباشرة؛ كل شيء عبر هذه الواجهة.
// كل المبالغ بالهللات (أعداد صحيحة). لا تخزين لبيانات البطاقة الخام.

export type PaymentProviderName = "moyasar";

export interface CheckoutInput {
  orderId: string;
  amountHalalas: number;
  currency: string; // SAR
  descriptionAr: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  callbackUrl: string; // بوابة → خادم (webhook)
  successUrl: string;
  backUrl: string;
  metadata?: Record<string, string>;
}

export interface CheckoutResult {
  ok: boolean;
  providerRef?: string; // معرّف الفاتورة/الجلسة لدى المزوّد
  url?: string; // رابط الدفع
  message?: string;
}

export type CanonicalPaymentStatus =
  | "paid"
  | "failed"
  | "pending"
  | "refunded"
  | "partially_refunded"
  | "unknown";

/** تمثيل مُوحّد للدفعة مستقل عن المزوّد. */
export interface CanonicalPayment {
  id: string; // معرّف الدفعة لدى المزوّد
  status: CanonicalPaymentStatus;
  amountHalalas: number;
  currency: string;
  feeHalalas?: number;
  methodType?: string; // creditcard | applepay | stcpay | mada …
  metadata?: Record<string, unknown>;
  raw: unknown;
}

/** حدث webhook مُوحّد. */
export interface CanonicalWebhookEvent {
  providerEventId: string;
  type: string;
  paymentId?: string;
  status: CanonicalPaymentStatus;
  amountHalalas?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  raw: unknown;
}

export interface WebhookVerification {
  valid: boolean;
  method: "hmac" | "shared-secret" | "none";
  enforced: boolean; // هل التحقق مُفعّل (سرّ مضبوط)؟
}

export interface RefundInput {
  providerPaymentId: string;
  amountHalalas?: number; // غياب = استرداد كامل
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  providerRefundId?: string;
  status?: "pending" | "succeeded" | "failed";
  message?: string;
}

export interface TokenizeInput {
  userId: string;
  providerToken: string; // توكن من جانب العميل (لا PAN)
}

export interface TokenizeResult {
  ok: boolean;
  providerCustomerId?: string;
  providerToken?: string;
  brand?: string;
  lastFour?: string;
  expiryMonth?: number;
  expiryYear?: number;
  message?: string;
}

export interface ChargeSavedInput {
  orderId: string;
  amountHalalas: number;
  currency: string;
  descriptionAr: string;
  providerToken: string;
  callbackUrl: string;
  metadata?: Record<string, string>;
}

export interface ChargeResult {
  ok: boolean;
  payment?: CanonicalPayment;
  message?: string;
}

export interface SettlementSummary {
  ok: boolean;
  settlements?: Array<{ id: string; amountHalalas: number; feeHalalas: number; status: string; date?: string }>;
  message?: string;
}

/** واجهة مزوّد الدفع الموحّدة. */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  isLive(): boolean;

  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** رابط فاتورة (قد يطابق createCheckout لدى بعض المزوّدين). */
  createInvoiceLink(input: CheckoutInput): Promise<CheckoutResult>;

  /** جلب الدفعة كما هي من البوابة (مصدر الحقيقة، §13). */
  getPayment(providerPaymentId: string): Promise<CanonicalPayment | null>;
  /** إعادة التحقق من نجاح الدفع من البوابة قبل أي منح. */
  verifyPayment(providerPaymentId: string): Promise<CanonicalPayment | null>;

  refundPayment(input: RefundInput): Promise<RefundResult>;
  tokenizePaymentMethod(input: TokenizeInput): Promise<TokenizeResult>;
  chargeSavedPaymentMethod(input: ChargeSavedInput): Promise<ChargeResult>;

  /** تحليل جسم webhook إلى حدث موحّد. */
  parseWebhook(rawBody: string): CanonicalWebhookEvent | null;
  /** تحقق توقيع/سرّ webhook (HMAC للجسم الخام أو سرّ مشترك). */
  verifyWebhook(rawBody: string, headers: Record<string, string | undefined>): WebhookVerification;

  getSettlement(params?: { from?: string; to?: string }): Promise<SettlementSummary>;
}

/** المزوّد المُهيّأ حاليًا (PAYMENT_PROVIDER=moyasar افتراضيًا). */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const name = (process.env.PAYMENT_PROVIDER || "moyasar").trim().toLowerCase();
  switch (name) {
    case "moyasar":
    default: {
      const { MoyasarProvider } = await import("./providers/moyasar");
      return new MoyasarProvider();
    }
  }
}
