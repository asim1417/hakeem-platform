// تنسيق رقم الفاتورة (نقيّ، بلا server-only، قابل للاختبار) — HKM-BILLING-UX-001 (§9).

/** رقم فاتورة متسلسل: PREFIX-YYYY-NNNNNN. */
export function formatInvoiceNumber(year: number, seq: number, prefix = "HKM"): string {
  return `${prefix}-${year}-${String(seq).padStart(6, "0")}`;
}
