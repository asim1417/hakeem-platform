// اختبار ترقيم الفواتير (المرحلة C) — نقيّ بلا قاعدة.
import { formatInvoiceNumber } from "@/lib/modules/billing/invoice-format";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

T("HKM-2026-000001", formatInvoiceNumber(2026, 1) === "HKM-2026-000001");
T("HKM-2026-000042", formatInvoiceNumber(2026, 42) === "HKM-2026-000042");
T("HKM-2026-123456", formatInvoiceNumber(2026, 123456) === "HKM-2026-123456");
T("بادئة مخصّصة", formatInvoiceNumber(2027, 7, "INV") === "INV-2027-000007");
T("تسلسل متزايد فريد", (() => {
  const a = formatInvoiceNumber(2026, 10);
  const b = formatInvoiceNumber(2026, 11);
  return a !== b && a < b;
})());

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);
