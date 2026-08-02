// تنفيذ Moyasar لواجهة PaymentProvider — HKM-BILLING-UX-001 (§7).
// يعيد استخدام منطق lib/modules/billing/moyasar.ts (إنشاء الفاتورة) ويضيف:
// إعادة تحقق من البوابة (getPayment/verifyPayment)، تحقق webhook (HMAC/سرّ مشترك)،
// استرداد، وتوكن. لا يُطبع أي مفتاح سري في السجلات.

import crypto from "crypto";
import type {
  CanonicalPayment,
  CanonicalPaymentStatus,
  CanonicalWebhookEvent,
  ChargeResult,
  ChargeSavedInput,
  CheckoutInput,
  CheckoutResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  SettlementSummary,
  TokenizeInput,
  TokenizeResult,
  WebhookVerification,
} from "../payment-provider";

const MOYASAR_API = "https://api.moyasar.com/v1";

function secretKey(): string {
  return (process.env.MOYASAR_SECRET_KEY || "").trim();
}

function webhookSecret(): string {
  return (process.env.MOYASAR_WEBHOOK_SECRET || "").trim();
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${secretKey()}:`).toString("base64");
}

function mapStatus(raw: string | undefined): CanonicalPaymentStatus {
  const s = (raw || "").toLowerCase();
  if (["paid", "captured", "verified", "authorized"].includes(s)) return "paid";
  if (["failed", "voided", "denied"].includes(s)) return "failed";
  if (["refunded"].includes(s)) return "refunded";
  if (["partially_refunded"].includes(s)) return "partially_refunded";
  if (["initiated", "pending", "processing"].includes(s)) return "pending";
  return "unknown";
}

interface MoyasarPaymentDto {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  fee?: number;
  source?: { type?: string };
  metadata?: Record<string, unknown>;
  message?: string;
  refunded?: number;
}

function toCanonical(dto: MoyasarPaymentDto): CanonicalPayment {
  return {
    id: dto.id || "",
    status: mapStatus(dto.status),
    amountHalalas: typeof dto.amount === "number" ? dto.amount : 0,
    currency: dto.currency || "SAR",
    feeHalalas: typeof dto.fee === "number" ? dto.fee : undefined,
    methodType: dto.source?.type,
    metadata: dto.metadata,
    raw: dto,
  };
}

/** مقارنة ثابتة الزمن لمنع تسريب التوقيت. */
function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export class MoyasarProvider implements PaymentProvider {
  readonly name = "moyasar" as const;

  isLive(): boolean {
    return Boolean(secretKey());
  }

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return this.createInvoiceLink(input);
  }

  async createInvoiceLink(input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isLive()) return { ok: false, message: "مفتاح Moyasar غير مضبوط." };
    if (!input.amountHalalas || input.amountHalalas <= 0) {
      return { ok: false, message: "المبلغ غير صالح." };
    }
    try {
      const res = await fetch(`${MOYASAR_API}/invoices`, {
        method: "POST",
        headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: input.amountHalalas,
          currency: input.currency || "SAR",
          description: input.descriptionAr,
          callback_url: input.callbackUrl,
          success_url: input.successUrl,
          back_url: input.backUrl,
          metadata: { orderId: input.orderId, userId: input.userId, ...(input.metadata || {}) },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        url?: string;
        status?: string;
        message?: string;
      };
      if (!res.ok || !data.id || !data.url) {
        return { ok: false, message: data.message || `تعذّر إنشاء فاتورة Moyasar (${res.status}).` };
      }
      return { ok: true, providerRef: data.id, url: data.url };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "خطأ شبكة مع Moyasar." };
    }
  }

  async getPayment(providerPaymentId: string): Promise<CanonicalPayment | null> {
    if (!this.isLive() || !providerPaymentId) return null;
    try {
      const res = await fetch(`${MOYASAR_API}/payments/${encodeURIComponent(providerPaymentId)}`, {
        headers: { Authorization: basicAuth() },
      });
      if (!res.ok) return null;
      const dto = (await res.json().catch(() => ({}))) as MoyasarPaymentDto;
      if (!dto.id) return null;
      return toCanonical(dto);
    } catch {
      return null;
    }
  }

  /** إعادة التحقق من البوابة = getPayment (مصدر الحقيقة، لا يُوثق بجسم webhook). */
  async verifyPayment(providerPaymentId: string): Promise<CanonicalPayment | null> {
    return this.getPayment(providerPaymentId);
  }

  async refundPayment(input: RefundInput): Promise<RefundResult> {
    if (!this.isLive()) return { ok: false, message: "مفتاح Moyasar غير مضبوط." };
    try {
      const body: Record<string, unknown> = {};
      if (input.amountHalalas && input.amountHalalas > 0) body.amount = input.amountHalalas;
      const res = await fetch(
        `${MOYASAR_API}/payments/${encodeURIComponent(input.providerPaymentId)}/refund`,
        {
          method: "POST",
          headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await res.json().catch(() => ({}))) as MoyasarPaymentDto;
      if (!res.ok) return { ok: false, message: data.message || `تعذّر الاسترداد (${res.status}).` };
      return { ok: true, providerRefundId: data.id, status: "succeeded" };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "خطأ شبكة مع Moyasar." };
    }
  }

  async tokenizePaymentMethod(input: TokenizeInput): Promise<TokenizeResult> {
    // Moyasar يُنشئ التوكن من جانب العميل؛ الخادم يخزّن المعرّف المرمّز فقط (لا PAN).
    if (!input.providerToken) return { ok: false, message: "توكن الدفع مفقود." };
    return { ok: true, providerToken: input.providerToken, providerCustomerId: input.userId };
  }

  async chargeSavedPaymentMethod(input: ChargeSavedInput): Promise<ChargeResult> {
    if (!this.isLive()) return { ok: false, message: "مفتاح Moyasar غير مضبوط." };
    if (!input.providerToken) return { ok: false, message: "توكن الدفع مفقود." };
    try {
      const res = await fetch(`${MOYASAR_API}/payments`, {
        method: "POST",
        headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: input.amountHalalas,
          currency: input.currency || "SAR",
          description: input.descriptionAr,
          callback_url: input.callbackUrl,
          source: { type: "token", token: input.providerToken },
          metadata: { orderId: input.orderId, ...(input.metadata || {}) },
        }),
      });
      const dto = (await res.json().catch(() => ({}))) as MoyasarPaymentDto;
      if (!res.ok || !dto.id) {
        return { ok: false, message: dto.message || `تعذّر الخصم (${res.status}).` };
      }
      return { ok: true, payment: toCanonical(dto) };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "خطأ شبكة مع Moyasar." };
    }
  }

  parseWebhook(rawBody: string): CanonicalWebhookEvent | null {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }
    const data = (body.data as Record<string, unknown>) || body;
    const id =
      (body.id as string) ||
      (data.id as string) ||
      (body.event_id as string) ||
      "";
    const paymentId = (data.id as string) || (body.payment_id as string) || undefined;
    const status = mapStatus((data.status as string) || (body.status as string));
    const amount = (data.amount as number) ?? (body.amount as number);
    const currency = (data.currency as string) || (body.currency as string);
    const metadata = (data.metadata as Record<string, unknown>) || (body.metadata as Record<string, unknown>);
    return {
      providerEventId: id || paymentId || "",
      type: (body.type as string) || "payment",
      paymentId,
      status,
      amountHalalas: typeof amount === "number" ? amount : undefined,
      currency,
      metadata,
      raw: body,
    };
  }

  verifyWebhook(
    rawBody: string,
    headers: Record<string, string | undefined>
  ): WebhookVerification {
    const secret = webhookSecret();
    if (!secret) return { valid: false, method: "none", enforced: false };

    // 1) توقيع HMAC للجسم الخام إن وُجدت ترويسة توقيع.
    const sigHeader =
      headers["x-moyasar-signature"] ||
      headers["x-signature"] ||
      headers["moyasar-signature"];
    if (sigHeader) {
      const computed = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
      const provided = sigHeader.replace(/^sha256=/i, "").trim();
      return { valid: timingSafeEqual(computed, provided), method: "hmac", enforced: true };
    }

    // 2) سرّ مشترك في جسم الطلب (نموذج Moyasar الافتراضي) — مقارنة ثابتة الزمن.
    try {
      const body = JSON.parse(rawBody) as { secret_token?: string; secret?: string };
      const token = (body.secret_token || body.secret || "").toString();
      return { valid: Boolean(token) && timingSafeEqual(token, secret), method: "shared-secret", enforced: true };
    } catch {
      return { valid: false, method: "shared-secret", enforced: true };
    }
  }

  async getSettlement(params?: { from?: string; to?: string }): Promise<SettlementSummary> {
    if (!this.isLive()) return { ok: false, message: "مفتاح Moyasar غير مضبوط." };
    try {
      const qs = new URLSearchParams();
      if (params?.from) qs.set("created[gte]", params.from);
      if (params?.to) qs.set("created[lte]", params.to);
      const res = await fetch(`${MOYASAR_API}/settlements?${qs.toString()}`, {
        headers: { Authorization: basicAuth() },
      });
      if (!res.ok) return { ok: false, message: `تعذّر جلب التسويات (${res.status}).` };
      const data = (await res.json().catch(() => ({}))) as {
        settlements?: Array<{ id?: string; amount?: number; fees?: number; status?: string; created_at?: string }>;
      };
      const settlements = (data.settlements || []).map((s) => ({
        id: s.id || "",
        amountHalalas: typeof s.amount === "number" ? s.amount : 0,
        feeHalalas: typeof s.fees === "number" ? s.fees : 0,
        status: s.status || "unknown",
        date: s.created_at,
      }));
      return { ok: true, settlements };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "خطأ شبكة مع Moyasar." };
    }
  }
}
