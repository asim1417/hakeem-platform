import "server-only";

// الفوترة الضريبية — HKM-BILLING-UX-001 (§9). أرقام متسلسلة غير قابلة لإعادة الاستخدام،
// لقطة بائع/مشتري وقت الإصدار، منع التعديل بعد الإصدار (إشعار دائن بدل التعديل).
// كل المبالغ بالهللات. الربط بمزود فوترة إلكترونية عبر einvoice-provider (§9).

import type { Prisma } from "@prisma/client";
import { formatInvoiceNumber } from "@/lib/modules/billing/invoice-format";
import {
  buildQrTlv,
  buildUblXml,
  halalasToSarString,
  invoiceHash,
  invoiceUuid,
} from "@/lib/modules/billing/zatca";

export { formatInvoiceNumber };

function zatcaEnabled(): boolean {
  return /^(1|true|on)$/i.test(process.env.ZATCA_INTEGRATION_ENABLED || "");
}

interface ZatcaFields {
  uuid: string | null;
  qr: string | null;
  pih: string | null;
  hash: string | null;
  xml: string | null;
}

const EMPTY_ZATCA: ZatcaFields = { uuid: null, qr: null, pih: null, hash: null, xml: null };

/** توليد عناصر ZATCA المرحلة 1 (عند تفعيل العلم) مع سلسلة PIH. */
async function computeZatca(
  tx: Prisma.TransactionClient,
  input: {
    invoiceNumber: string;
    issuedAtIso: string;
    currency: string;
    seller: CompanySnapshot;
    buyer: { nameAr?: string; vatNumber?: string };
    subtotalHalalas: number;
    vatHalalas: number;
    totalHalalas: number;
    vatRateBps: number;
    type: "TAX_INVOICE" | "SIMPLIFIED_TAX_INVOICE" | "CREDIT_NOTE";
  }
): Promise<ZatcaFields> {
  if (!zatcaEnabled()) return EMPTY_ZATCA;
  const prev = await tx.$queryRawUnsafe<{ zatca_hash: string | null }[]>(
    `SELECT "zatca_hash" FROM "billing_invoices"
      WHERE "zatca_hash" IS NOT NULL ORDER BY "created_at" DESC LIMIT 1`
  );
  const previousHash = prev[0]?.zatca_hash ?? null;
  const uuid = invoiceUuid();
  const hash = invoiceHash({
    uuid,
    invoiceNumber: input.invoiceNumber,
    issuedAtIso: input.issuedAtIso,
    totalHalalas: input.totalHalalas,
    vatHalalas: input.vatHalalas,
    previousHash,
  });
  const qr = buildQrTlv({
    sellerName: input.seller.legalNameAr,
    vatNumber: input.seller.vatNumber,
    timestampIso: input.issuedAtIso,
    totalWithVatSar: halalasToSarString(input.totalHalalas),
    vatTotalSar: halalasToSarString(input.vatHalalas),
  });
  const xml = buildUblXml({
    uuid,
    invoiceNumber: input.invoiceNumber,
    issuedAtIso: input.issuedAtIso,
    currency: input.currency,
    seller: { legalNameAr: input.seller.legalNameAr, vatNumber: input.seller.vatNumber, crNumber: input.seller.crNumber },
    buyer: { nameAr: input.buyer.nameAr || "", vatNumber: input.buyer.vatNumber },
    subtotalHalalas: input.subtotalHalalas,
    vatHalalas: input.vatHalalas,
    totalHalalas: input.totalHalalas,
    vatRateBps: input.vatRateBps,
    type: input.type,
    previousHash,
  });
  return { uuid, qr, pih: previousHash, hash, xml };
}

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
    const invType = input.type || "TAX_INVOICE";
    const issuedAtIso = new Date().toISOString();
    const z = await computeZatca(tx, {
      invoiceNumber,
      issuedAtIso,
      currency: input.currency,
      seller,
      buyer: { nameAr: input.buyer.nameAr, vatNumber: input.buyer.vatNumber },
      subtotalHalalas: input.subtotalHalalas,
      vatHalalas: input.vatHalalas,
      totalHalalas: input.totalHalalas,
      vatRateBps: input.vatRateBps,
      type: invType,
    });
    await tx.$executeRawUnsafe(
      `INSERT INTO "billing_invoices"
        ("id","invoice_number","user_id","order_id","type","status","currency",
         "subtotal_halalas","vat_rate_bps","vat_halalas","total_halalas",
         "seller_snapshot","buyer_snapshot","issued_at","zatca_status",
         "zatca_uuid","zatca_qr","zatca_pih","zatca_hash","zatca_xml")
       VALUES ($1,$2,$3,$4,$5,'ISSUED',$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,NOW(),
         CASE WHEN $13 THEN 'PENDING' ELSE 'NOT_APPLICABLE' END,$14,$15,$16,$17,$18)`,
      id,
      invoiceNumber,
      input.userId,
      input.orderId,
      invType,
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
      zatcaEnabled(),
      z.uuid,
      z.qr,
      z.pih,
      z.hash,
      z.xml
    );
    return { id, invoiceNumber, reused: false };
  });
}

/**
 * إصدار إشعار دائن (CREDIT_NOTE) عند الاسترداد — بدل تعديل الفاتورة الأصلية (§9، ZATCA).
 * يشير إلى الفاتورة الأصلية عبر رقمها. idempotent عبر مفتاح الاسترداد في buyerSnapshot.
 */
export async function issueCreditNote(input: {
  refundId: string;
  userId: string;
  currency: string;
  subtotalHalalas: number;
  vatRateBps: number;
  vatHalalas: number;
  totalHalalas: number;
  originalInvoiceNumber: string | null;
  buyer: { nameAr?: string; email?: string; vatNumber?: string };
  issuedYear: number;
}) {
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRawUnsafe<{ id: string; invoice_number: string }[]>(
      `SELECT id, "invoice_number" FROM "billing_invoices"
        WHERE "type" = 'CREDIT_NOTE' AND "buyer_snapshot"->>'refundId' = $1 LIMIT 1`,
      input.refundId
    );
    if (existing[0]) {
      return { id: existing[0].id, invoiceNumber: existing[0].invoice_number, reused: true };
    }
    const invoiceNumber = await nextInvoiceNumber(tx, input.issuedYear);
    const seller = sellerSnapshot();
    const id = `cn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const issuedAtIso = new Date().toISOString();
    const z = await computeZatca(tx, {
      invoiceNumber,
      issuedAtIso,
      currency: input.currency,
      seller,
      buyer: { nameAr: input.buyer.nameAr, vatNumber: input.buyer.vatNumber },
      subtotalHalalas: input.subtotalHalalas,
      vatHalalas: input.vatHalalas,
      totalHalalas: input.totalHalalas,
      vatRateBps: input.vatRateBps,
      type: "CREDIT_NOTE",
    });
    await tx.$executeRawUnsafe(
      `INSERT INTO "billing_invoices"
        ("id","invoice_number","user_id","order_id","type","status","currency",
         "subtotal_halalas","vat_rate_bps","vat_halalas","total_halalas",
         "seller_snapshot","buyer_snapshot","issued_at","zatca_status",
         "zatca_uuid","zatca_qr","zatca_pih","zatca_hash","zatca_xml")
       VALUES ($1,$2,$3,NULL,'CREDIT_NOTE','ISSUED',$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,NOW(),
         CASE WHEN $11 THEN 'PENDING' ELSE 'NOT_APPLICABLE' END,$12,$13,$14,$15,$16)`,
      id,
      invoiceNumber,
      input.userId,
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
        refundId: input.refundId,
        originalInvoiceNumber: input.originalInvoiceNumber || "",
      }),
      zatcaEnabled(),
      z.uuid,
      z.qr,
      z.pih,
      z.hash,
      z.xml
    );
    return { id, invoiceNumber, reused: false };
  });
}
