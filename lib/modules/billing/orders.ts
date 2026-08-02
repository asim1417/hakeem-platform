import "server-only";

// الطلبات — HKM-BILLING-UX-001 (§8). المبالغ تُحسب في الخادم فقط (لا يثق بالعميل).
// idempotent عبر idempotencyKey. كل المبالغ بالهللات.

import { randomBytes } from "crypto";
import { splitVatInclusive, vatRateBps } from "@/lib/modules/credits/points";

export type OrderType =
  | "SUBSCRIPTION_NEW"
  | "SUBSCRIPTION_RENEWAL"
  | "SUBSCRIPTION_UPGRADE"
  | "SUBSCRIPTION_DOWNGRADE"
  | "POINTS_PACKAGE";

export interface OrderRecord {
  id: string;
  userId: string;
  type: OrderType;
  status: string;
  currency: string;
  subtotalHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  planId: string | null;
  pointsPackageCode: string | null;
  pointsGranted: number | null;
  idempotencyKey: string;
}

function orderId(): string {
  return `ord_${randomBytes(12).toString("hex")}`;
}

/** إنشاء طلب اشتراك بمبالغ من PlanPrice الفعّال (خادمي، موثوق). */
export async function createSubscriptionOrder(input: {
  userId: string;
  planCode: string;
  period: "MONTHLY" | "YEARLY";
  type?: OrderType;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; order?: OrderRecord; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });
  if (!plan || !plan.isActive) return { ok: false, message: "الباقة غير متاحة." };

  const price = await prisma.planPrice.findFirst({
    where: { planId: plan.id, billingPeriod: input.period, isActive: true },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!price) return { ok: false, message: "لا سعر فعّال لهذه الباقة/الفترة." };

  const idem = input.idempotencyKey || `sub:${input.userId}:${plan.code}:${input.period}:${orderId()}`;
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: idem } });
  if (existing) return { ok: true, order: toRecord(existing) };

  const created = await prisma.order.create({
    data: {
      id: orderId(),
      userId: input.userId,
      type: input.type || "SUBSCRIPTION_NEW",
      status: "AWAITING_PAYMENT",
      currency: price.currency,
      subtotalHalalas: price.subtotalHalalas,
      vatHalalas: price.vatHalalas,
      totalHalalas: price.totalHalalas,
      planId: plan.id,
      pointsGranted: plan.monthlyPoints,
      idempotencyKey: idem,
      metadata: { planCode: plan.code, period: input.period },
    },
  });
  return { ok: true, order: toRecord(created) };
}

/** إنشاء طلب حزمة نقاط (السعر شامل الضريبة → يُقسَّم). */
export async function createPackageOrder(input: {
  userId: string;
  packageCode: string;
  idempotencyKey?: string;
}): Promise<{ ok: boolean; order?: OrderRecord; message?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRawUnsafe<
    { code: string; unitsMilli: bigint | number; priceHalalas: number; active: boolean }[]
  >(
    `SELECT code, "unitsMilli", "priceHalalas", active
       FROM "usage_credit_packages" WHERE code = $1 LIMIT 1`,
    input.packageCode
  );
  const pkg = rows[0];
  if (!pkg || !pkg.active) return { ok: false, message: "الحزمة غير متاحة." };

  const split = splitVatInclusive(Number(pkg.priceHalalas), vatRateBps());
  const points = Math.round(Number(pkg.unitsMilli) / 1000);
  const idem = input.idempotencyKey || `pkg:${input.userId}:${pkg.code}:${orderId()}`;
  const existing = await prisma.order.findUnique({ where: { idempotencyKey: idem } });
  if (existing) return { ok: true, order: toRecord(existing) };

  const created = await prisma.order.create({
    data: {
      id: orderId(),
      userId: input.userId,
      type: "POINTS_PACKAGE",
      status: "AWAITING_PAYMENT",
      currency: "SAR",
      subtotalHalalas: split.subtotalHalalas,
      vatHalalas: split.vatHalalas,
      totalHalalas: split.totalHalalas,
      pointsPackageCode: pkg.code,
      pointsGranted: points,
      idempotencyKey: idem,
      metadata: { packageCode: pkg.code, points },
    },
  });
  return { ok: true, order: toRecord(created) };
}

export async function getOrder(id: string): Promise<OrderRecord | null> {
  const { prisma } = await import("@/lib/prisma");
  const o = await prisma.order.findUnique({ where: { id } });
  return o ? toRecord(o) : null;
}

function toRecord(o: {
  id: string;
  userId: string;
  type: string;
  status: string;
  currency: string;
  subtotalHalalas: number;
  vatHalalas: number;
  totalHalalas: number;
  planId: string | null;
  pointsPackageCode: string | null;
  pointsGranted: number | null;
  idempotencyKey: string;
}): OrderRecord {
  return {
    id: o.id,
    userId: o.userId,
    type: o.type as OrderType,
    status: o.status,
    currency: o.currency,
    subtotalHalalas: o.subtotalHalalas,
    vatHalalas: o.vatHalalas,
    totalHalalas: o.totalHalalas,
    planId: o.planId,
    pointsPackageCode: o.pointsPackageCode,
    pointsGranted: o.pointsGranted,
    idempotencyKey: o.idempotencyKey,
  };
}
