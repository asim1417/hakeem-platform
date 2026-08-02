import "server-only";

// الفوترة الضريبية — HKM-BILLING-UX-001 (§9). أرقام متسلسلة غير قابلة لإعادة الاستخدام،
// لقطة بائع/مشتري وقت الإصدار، منع التعديل بعد الإصدار (إشعار دائن بدل التعديل).
// كل المبالغ بالهللات. الربط بمزود فوترة إلكترونية عبر einvoice-provider (§9).

import type { Prisma } from "@prisma/client";
import { formatInvoiceNumber } from "@/lib/modules/billing/invoice-format";

export { formatInvoiceNumber };

export interface CompanySnapshot {
  legalNameAr: string;
  legalNameEn: string;
  vatNumber: string;
  crNumber: string;
  address: Record<string, unknown>;
}

/** لقطة البائع من متغيّرات البيئة (COMPANY_*). */
export function sellerSnapshot(): CompanySnapshot {
  let address: Record<string, unknown> = {};
  try {
    address = JSON.parse(process.env.COMPANY_ADDRESS_JSON || "{}");
  } catch {
    address = {};
  }
  return {
    legalNameAr: process.env.COMPANY_LEGAL_NAME_AR || "منصة حكيم",
    legalNameEn: process.env.COMPANY_LEGAL_NAME_EN || "Hakeem Platform",
    vatNumber: process.env.COMPANY_VAT_NUMBER || "",
    crNumber: process.env.COMPANY_CR_NUMBER || "",
    address,
  };
}

/** رقم فاتورة تالٍ ذرّي لكل سنة (يتطلب billing_invoice_counters). */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const rows = await tx.$queryRawUnsafe<{ last_seq: number }[]>(
    `INSERT INTO "billing_invoice_counters" ("year","last_seq") VALUES ($1, 1)
     ON CONFLICT ("year") DO UPDATE SET "last_seq" = "billing_invoice_counters"."last_seq" + 1
     RETURNING "last_seq"`,
    year
  );
  const seq = Number(rows[0]?.last_seq || 1);
  return formatInvoiceNumber(year, seq);
}

export interface IssueInvoiceInput {
  orderId: string;
  userId: string;
  currency: string;
  subtotalHalalas: number;
  vatRateBps: number;
  vatHalalas: number;
  totalHalalas: number;
  type?: "TAX_INVOICE" | "SIMPLIFIED_TAX_INVOICE" | "CREDIT_NOTE";
  buyer: { nameAr?: string; email?: string; vatNumber?: string };
  issuedYear: number; // يُمرَّر لتجنّب استخدام التاريخ داخل منطق قابل للاختبار
}

/**
 * إصدار فاتورة لطلب (idempotent عبر order_id الفريد). لا تعديل بعد الإصدار.
 * يعيد الفاتورة (أو الموجودة سلفًا).
 */
export async function issueInvoiceForOrder(input: IssueInvoiceInput) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRawUnsafe<{ id: string; invoice_number: string }[]>(
      `SELECT id, "invoice_number" FROM "billing_invoices" WHERE "order_id" = $1 LIMIT 1`,
      input.orderId
    );
    if (existing[0]) {
      return { id: existing[0].id, invoiceNumber: existing[0].invoice_number, reused: true };
    }
    const invoiceNumber = await nextInvoiceNumber(tx, input.issuedYear);
    const seller = sellerSnapshot();
    const id = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    await tx.$executeRawUnsafe(
      `INSERT INTO "billing_invoices"
        ("id","invoice_number","user_id","order_id","type","status","currency",
         "subtotal_halalas","vat_rate_bps","vat_halalas","total_halalas",
         "seller_snapshot","buyer_snapshot","issued_at","zatca_status")
       VALUES ($1,$2,$3,$4,$5,'ISSUED',$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,NOW(),
         CASE WHEN $13 THEN 'PENDING' ELSE 'NOT_APPLICABLE' END)`,
      id,
      invoiceNumber,
      input.userId,
      input.orderId,
      input.type || "TAX_INVOICE",
      input.currency,
      input.subtotalHalalas,
      input.vatRateBps,
      input.vatHalalas,
      input.totalHalalas,
      JSON.stringify(seller),
      JSON.stringify({
        nameAr: input.buyer.nameAr || "",
        email: input.buyer.email || "",
        vatNumber: input.buyer.vatNumber || "",
      }),
      /^(1|true|on)$/i.test(process.env.ZATCA_INTEGRATION_ENABLED || "")
    );
    return { id, invoiceNumber, reused: false };
  });
}
