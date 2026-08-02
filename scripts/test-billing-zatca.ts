// اختبار توليد ZATCA المرحلة 1 (نقيّ) — HKM-BILLING-UX-001 (§9).
import { buildQrTlv, invoiceHash, buildUblXml, halalasToSarString } from "@/lib/modules/billing/zatca";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

// ── هللات → ريال ──
T("halalasToSarString(4900) = 49.00", halalasToSarString(4900) === "49.00");
T("halalasToSarString(639) = 6.39", halalasToSarString(639) === "6.39");

// ── QR TLV ──
const qr = buildQrTlv({
  sellerName: "حكيم",
  vatNumber: "300000000000003",
  timestampIso: "2026-08-02T10:00:00Z",
  totalWithVatSar: "49.00",
  vatTotalSar: "6.39",
});
const buf = Buffer.from(qr, "base64");
T("QR: base64 صالح غير فارغ", buf.length > 0);
T("QR: يبدأ بالوسم 1 (اسم البائع)", buf[0] === 0x01);
// الوسم 1، الطول = بايتات 'حكيم' UTF-8 (4 حروف عربية × 2 = 8)
const sellerBytes = Buffer.from("حكيم", "utf8").length;
T("QR: طول اسم البائع صحيح", buf[1] === sellerBytes);
// بعد اسم البائع يأتي الوسم 2
T("QR: الوسم الثاني = 2 (الرقم الضريبي)", buf[2 + sellerBytes] === 0x02);

// ── هاش الفاتورة (PIH) ──
const h1 = invoiceHash({ uuid: "u1", invoiceNumber: "HKM-2026-000001", issuedAtIso: "2026-08-02T10:00:00Z", totalHalalas: 4900, vatHalalas: 639, previousHash: null });
const h1b = invoiceHash({ uuid: "u1", invoiceNumber: "HKM-2026-000001", issuedAtIso: "2026-08-02T10:00:00Z", totalHalalas: 4900, vatHalalas: 639, previousHash: null });
T("هاش: حتمي (نفس المدخلات = نفس الهاش)", h1 === h1b);
const h2 = invoiceHash({ uuid: "u2", invoiceNumber: "HKM-2026-000002", issuedAtIso: "2026-08-02T11:00:00Z", totalHalalas: 14900, vatHalalas: 1943, previousHash: h1 });
T("هاش: يتغيّر بتغيّر المدخلات", h1 !== h2);
T("هاش: السلسلة تعتمد على السابق", (() => {
  const withPrev = invoiceHash({ uuid: "u2", invoiceNumber: "HKM-2026-000002", issuedAtIso: "2026-08-02T11:00:00Z", totalHalalas: 14900, vatHalalas: 1943, previousHash: h1 });
  const noPrev = invoiceHash({ uuid: "u2", invoiceNumber: "HKM-2026-000002", issuedAtIso: "2026-08-02T11:00:00Z", totalHalalas: 14900, vatHalalas: 1943, previousHash: null });
  return withPrev !== noPrev;
})());
T("هاش: base64 بطول SHA-256 (44)", h1.length === 44);

// ── UBL XML ──
const xml = buildUblXml({
  uuid: "u1",
  invoiceNumber: "HKM-2026-000001",
  issuedAtIso: "2026-08-02T10:00:00Z",
  currency: "SAR",
  seller: { legalNameAr: "منصة حكيم", vatNumber: "300000000000003", crNumber: "1010101010" },
  buyer: { nameAr: "محمد", vatNumber: undefined },
  subtotalHalalas: 4261,
  vatHalalas: 639,
  totalHalalas: 4900,
  vatRateBps: 1500,
  type: "TAX_INVOICE",
  previousHash: null,
});
T("UBL: يحوي رقم الفاتورة", xml.includes("HKM-2026-000001"));
T("UBL: يحوي UUID", xml.includes("<cbc:UUID>u1</cbc:UUID>"));
T("UBL: نوع فاتورة ضريبية 388", xml.includes("<cbc:InvoiceTypeCode>388</cbc:InvoiceTypeCode>"));
T("UBL: الإجمالي 49.00", xml.includes("49.00"));
T("UBL: النسبة 15.00", xml.includes("<cbc:Percent>15.00</cbc:Percent>"));
const cn = buildUblXml({ uuid: "u3", invoiceNumber: "HKM-2026-000003", issuedAtIso: "2026-08-02T12:00:00Z", currency: "SAR", seller: { legalNameAr: "حكيم", vatNumber: "3", crNumber: "1" }, buyer: { nameAr: "x" }, subtotalHalalas: 100, vatHalalas: 15, totalHalalas: 115, vatRateBps: 1500, type: "CREDIT_NOTE", previousHash: null });
T("UBL: إشعار دائن نوع 381", cn.includes("<cbc:InvoiceTypeCode>381</cbc:InvoiceTypeCode>"));

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
