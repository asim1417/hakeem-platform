// توليد عناصر ZATCA المرحلة 1 (Generation) — HKM-BILLING-UX-001 (§9).
// UUID + QR (TLV/base64) + PIH (سلسلة هاش) + UBL 2.1 XML مبسّط.
// ملاحظة توافق: هذا توليد المرحلة 1 فقط. المرحلة 2 (CSID/المقاصّة/الإبلاغ) تتطلب مزودًا
// معتمدًا وشهادة Fatoora — لا يُدّعى التوافق النهائي قبلها.

import crypto from "crypto";

/** TLV واحد: [tag][length][value] بترميز UTF-8. */
function tlv(tag: number, value: string): Buffer {
  const val = Buffer.from(value, "utf8");
  // طول أحادي البايت يكفي لحقول QR القياسية (< 256 بايت).
  return Buffer.concat([Buffer.from([tag]), Buffer.from([val.length & 0xff]), val]);
}

export interface QrFields {
  sellerName: string;
  vatNumber: string;
  timestampIso: string; // ISO8601
  totalWithVatSar: string; // "57.50"
  vatTotalSar: string; // "7.50"
}

/** بناء رمز QR وفق ZATCA (TLV مُرمّز base64). */
export function buildQrTlv(f: QrFields): string {
  const buf = Buffer.concat([
    tlv(1, f.sellerName),
    tlv(2, f.vatNumber),
    tlv(3, f.timestampIso),
    tlv(4, f.totalWithVatSar),
    tlv(5, f.vatTotalSar),
  ]);
  return buf.toString("base64");
}

/** هللات → سلسلة ريال بخانتين عشريتين. */
export function halalasToSarString(halalas: number): string {
  return (Math.round(halalas) / 100).toFixed(2);
}

/** UUID للفاتورة (ZATCA). */
export function invoiceUuid(): string {
  return crypto.randomUUID();
}

export interface InvoiceHashInput {
  uuid: string;
  invoiceNumber: string;
  issuedAtIso: string;
  totalHalalas: number;
  vatHalalas: number;
  previousHash: string | null; // PIH
}

/** هاش الفاتورة المُتسلسل (PIH chain) — SHA-256 base64. */
export function invoiceHash(input: InvoiceHashInput): string {
  const payload = [
    input.previousHash ?? "0",
    input.uuid,
    input.invoiceNumber,
    input.issuedAtIso,
    String(input.totalHalalas),
    String(input.vatHalalas),
  ].join("|");
  return crypto.createHash("sha256").update(payload, "utf8").digest("base64");
}

export interface UblInput {
  uuid: string;
  invoiceNumber: string;
  issuedAtIso: string;
  currency: string;
  seller: { legalNameAr: string; vatNumber: string; crNumber: string };
  buyer: { nameAr: string; vatNumber?: string };
  subtotalHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  vatRateBps: number;
  type: "TAX_INVOICE" | "SIMPLIFIED_TAX_INVOICE" | "CREDIT_NOTE";
  previousHash: string | null;
}

function esc(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] || c));
}

/** UBL 2.1 XML مبسّط (بنية أساسية؛ التوقيع/الختم في المرحلة 2). */
export function buildUblXml(u: UblInput): string {
  const typeCode = u.type === "CREDIT_NOTE" ? "381" : "388";
  const subtotal = halalasToSarString(u.subtotalHalalas);
  const vat = halalasToSarString(u.vatHalalas);
  const total = halalasToSarString(u.totalHalalas);
  const rate = (u.vatRateBps / 100).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:ID>${esc(u.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(u.uuid)}</cbc:UUID>
  <cbc:IssueDate>${esc(u.issuedAtIso.slice(0, 10))}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${esc(u.currency)}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(u.seller.legalNameAr)}</cbc:RegistrationName></cac:PartyLegalEntity>
    <cac:PartyTaxScheme><cbc:CompanyID>${esc(u.seller.vatNumber)}</cbc:CompanyID></cac:PartyTaxScheme>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(u.buyer.nameAr)}</cbc:RegistrationName></cac:PartyLegalEntity>
    ${u.buyer.vatNumber ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(u.buyer.vatNumber)}</cbc:CompanyID></cac:PartyTaxScheme>` : ""}
  </cac:Party></cac:AccountingCustomerParty>
  <cac:TaxTotal><cbc:TaxAmount currencyID="${esc(u.currency)}">${vat}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="${esc(u.currency)}">${subtotal}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${esc(u.currency)}">${vat}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:Percent>${rate}</cbc:Percent></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${esc(u.currency)}">${subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${esc(u.currency)}">${subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${esc(u.currency)}">${total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${esc(u.currency)}">${total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;
}
