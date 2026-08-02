// تجريد مزود الفوترة الإلكترونية (ZATCA) — HKM-BILLING-UX-001 (§9).
// قابل للربط بمزود متوافق أو منصة محاسبة قائمة. خلف علم ZATCA_INTEGRATION_ENABLED.
// لا ادعاء توافق نهائي قبل الاختبارات النظامية. الافتراضي: no-op يترك الحالة NOT_APPLICABLE.

export interface EInvoiceSubmitInput {
  invoiceId: string;
  invoiceNumber: string;
  type: "TAX_INVOICE" | "SIMPLIFIED_TAX_INVOICE" | "CREDIT_NOTE";
  seller: Record<string, unknown>;
  buyer: Record<string, unknown>;
  subtotalHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  issuedAt: string;
}

export type EInvoiceStatus = "NOT_APPLICABLE" | "PENDING" | "REPORTED" | "CLEARED" | "FAILED";

export interface EInvoiceResult {
  ok: boolean;
  status: EInvoiceStatus;
  qr?: string;
  xmlUrl?: string;
  pdfUrl?: string;
  message?: string;
}

export interface EInvoiceProvider {
  readonly name: string;
  isEnabled(): boolean;
  submit(input: EInvoiceSubmitInput): Promise<EInvoiceResult>;
  submitCreditNote(input: EInvoiceSubmitInput): Promise<EInvoiceResult>;
}

/** مزود افتراضي معطّل — لا يرسل شيئًا حتى ربط مزود حقيقي واجتياز الاختبارات. */
class DisabledEInvoiceProvider implements EInvoiceProvider {
  readonly name = "disabled";
  isEnabled(): boolean {
    return /^(1|true|on)$/i.test(process.env.ZATCA_INTEGRATION_ENABLED || "");
  }
  async submit(): Promise<EInvoiceResult> {
    return {
      ok: false,
      status: this.isEnabled() ? "PENDING" : "NOT_APPLICABLE",
      message: this.isEnabled()
        ? "ZATCA مفعّل لكن لا مزود مربوط بعد — الحالة تبقى PENDING."
        : "تكامل ZATCA غير مفعّل.",
    };
  }
  async submitCreditNote(): Promise<EInvoiceResult> {
    return this.submit();
  }
}

export function getEInvoiceProvider(): EInvoiceProvider {
  // مكان ربط المزود الحقيقي مستقبلًا حسب PAYMENT/ZATCA config.
  return new DisabledEInvoiceProvider();
}
