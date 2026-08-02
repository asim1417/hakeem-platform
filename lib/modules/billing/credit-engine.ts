import "server-only";

// محرك الرصيد الموحّد — HKM-BILLING-UX-001 (§5). واجهة بالنقاط فوق محرك وحدات v2 + Buckets.
// 1 نقطة = 1000 milli-unit. المحفظة مصدر الإنفاذ؛ الـBuckets للمصدر/الانتهاء/التوزيع.
// كل الخصم داخل transaction مع أقفال صفوف (في usage-ledger). لا رصيد سالب.

import { randomBytes } from "crypto";
import {
  reserveUsageCredits,
  captureUsageCredits,
  releaseUsageCredits,
  grantUsageCreditsToBucket,
  adjustUsageCredits,
  expireBuckets,
  getUserBuckets,
  usageCreditsEnabled,
  UsageCreditsExhaustedError,
} from "@/lib/modules/credits/usage-ledger";
import { distributeBySource, type CreditSourceType } from "@/lib/modules/credits/bucket-allocation";
import { milliToPoints, milliToWholePoints, pointsToMilli } from "@/lib/modules/credits/points";
import { SEED_SERVICE_RATES } from "@/config/billing-plans";

export { UsageCreditsExhaustedError };

export type DocumentTier = "small" | "medium" | "large" | "xlarge";

export interface CostEstimateOptions {
  quantity?: number;
  opus?: boolean; // نموذج متقدم → OPUS_SURCHARGE
  proExport?: boolean; // تصدير احترافي → PRO_EXPORT
  documentTier?: DocumentTier; // للخدمات TIERED
}

export interface CostBreakdownLine {
  code: string;
  points: number;
}

export interface CostEstimate {
  serviceCode: string;
  points: number;
  milliUnits: number;
  version: number;
  breakdown: CostBreakdownLine[];
  requiresApproval: boolean; // مستند كبير جدًا → موافقة صريحة (§3)
}

const DOC_TIER_MULTIPLIER: Record<DocumentTier, number> = {
  small: 1,
  medium: 1.5,
  large: 2.5,
  xlarge: 4,
};

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

/** قراءة سعر خدمة من الجدول (نقاط)، مع سقوط للبذور. */
async function readServiceRatePoints(
  serviceCode: string
): Promise<{ points: number; version: number; unitSize: number } | null> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<
      { milliUnits: bigint | number; unitSize: number; active: boolean; version: number | null }[]
    >(
      `SELECT "milliUnits", "unitSize", active, "version"
         FROM "usage_service_prices" WHERE "serviceCode" = $1 LIMIT 1`,
      serviceCode
    );
    const row = rows[0];
    if (row?.active) {
      return {
        points: milliToPoints(Number(row.milliUnits)),
        version: Number(row.version ?? 1),
        unitSize: Number(row.unitSize || 1),
      };
    }
  } catch {
    /* سقوط للبذور */
  }
  const seed = SEED_SERVICE_RATES.find((s) => s.serviceCode === serviceCode);
  if (seed) return { points: seed.points, version: 1, unitSize: 1 };
  return null;
}

/** تقدير تكلفة الخدمة بالنقاط، مع الزيادات (Opus/تصدير/شرائح المستند). */
export async function estimateServiceCost(
  serviceCode: string,
  opts: CostEstimateOptions = {}
): Promise<CostEstimate> {
  const base = await readServiceRatePoints(serviceCode);
  if (!base) {
    return { serviceCode, points: 0, milliUnits: 0, version: 1, breakdown: [], requiresApproval: false };
  }
  const breakdown: CostBreakdownLine[] = [];
  const qty = Math.max(1, Math.ceil((opts.quantity ?? 1) / base.unitSize));
  let points = base.points * qty;

  // شرائح المستند (TIERED).
  const tier = opts.documentTier;
  if (tier && tier !== "small") {
    const multiplied = Math.round(base.points * DOC_TIER_MULTIPLIER[tier]);
    points = multiplied * qty;
  }
  breakdown.push({ code: serviceCode, points });

  // زيادة النموذج المتقدم.
  if (opts.opus) {
    const opus = await readServiceRatePoints("OPUS_SURCHARGE");
    if (opus) {
      points += opus.points;
      breakdown.push({ code: "OPUS_SURCHARGE", points: opus.points });
    }
  }
  // تصدير احترافي.
  if (opts.proExport) {
    const exp = await readServiceRatePoints("PRO_EXPORT");
    if (exp) {
      points += exp.points;
      breakdown.push({ code: "PRO_EXPORT", points: exp.points });
    }
  }

  return {
    serviceCode,
    points,
    milliUnits: Number(pointsToMilli(points)),
    version: base.version,
    breakdown,
    requiresApproval: tier === "xlarge",
  };
}

export interface WalletSummary {
  enabled: boolean;
  balancePoints: number;
  reservedPoints: number;
  availablePoints: number;
  bySource: Record<CreditSourceType, number>; // نقاط
  buckets: Array<{
    id: string;
    sourceType: CreditSourceType;
    remainingPoints: number;
    expiresAt: Date | null;
  }>;
}

/** ملخّص المحفظة بالنقاط + التوزيع حسب المصدر. الأعضاء يرون محفظة مساحة العمل. */
export async function getWalletSummary(rawUserId: string): Promise<WalletSummary> {
  const { resolveWalletOwner } = await import("@/lib/modules/billing/workspace");
  const userId = await resolveWalletOwner(rawUserId);
  const enabled = await usageCreditsEnabled();
  let balanceMilli = 0;
  let reservedMilli = 0;
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<
      { balanceMilliUnits: bigint | number; reservedMilliUnits: bigint | number }[]
    >(
      `SELECT "balanceMilliUnits", "reservedMilliUnits"
         FROM "usage_credit_accounts" WHERE "userId" = $1 LIMIT 1`,
      userId
    );
    if (rows[0]) {
      balanceMilli = Number(rows[0].balanceMilliUnits);
      reservedMilli = Number(rows[0].reservedMilliUnits);
    }
  } catch {
    /* غير مُهيّأ */
  }
  const buckets = await getUserBuckets(userId);
  const bySourceMilli = distributeBySource(buckets);
  const bySource = Object.fromEntries(
    Object.entries(bySourceMilli).map(([k, v]) => [k, milliToPoints(v)])
  ) as Record<CreditSourceType, number>;

  return {
    enabled,
    balancePoints: milliToPoints(balanceMilli),
    reservedPoints: milliToPoints(reservedMilli),
    availablePoints: milliToPoints(Math.max(0, balanceMilli - reservedMilli)),
    bySource,
    buckets: buckets.map((b) => ({
      id: b.id,
      sourceType: b.sourceType,
      remainingPoints: milliToPoints(b.remainingMilliUnits),
      expiresAt: b.expiresAt,
    })),
  };
}

/** الرصيد المتاح بالنقاط. */
export async function getAvailableBalance(userId: string): Promise<number> {
  const s = await getWalletSummary(userId);
  return s.availablePoints;
}

/** تقدير عدد الاستخدامات المتبقّية لخدمة معيّنة. */
export async function getEstimatedRemainingUses(
  userId: string,
  serviceCode: string
): Promise<number> {
  const [available, cost] = await Promise.all([
    getAvailableBalance(userId),
    estimateServiceCost(serviceCode),
  ]);
  if (cost.points <= 0) return 0;
  return Math.floor(available / cost.points);
}

/** حجز رصيد لخدمة (reserve). يعيد reservationId. */
export async function reserveCredits(input: {
  userId: string;
  serviceCode: string;
  quantity?: number;
  idempotencyKey: string;
  referenceId?: string;
  /** نقاط مُقدَّرة كاملة (شاملة الزيادات) لحجزها مقدّمًا بدل السعر الأساسي. */
  estimatedPoints?: number;
}): Promise<{ enabled: boolean; reservationId: string | null; estimatedPoints: number }> {
  // reserveUsageCredits يقرأ السعر من الجدول بالكود؛ الأكواد الجديدة مبذورة فيه.
  const res = await reserveUsageCredits({
    userId: input.userId,
    serviceCode: input.serviceCode as never,
    quantity: input.quantity,
    idempotencyKey: input.idempotencyKey,
    referenceId: input.referenceId,
    overrideMilliUnits:
      input.estimatedPoints && input.estimatedPoints > 0
        ? Number(pointsToMilli(input.estimatedPoints))
        : undefined,
  });
  return {
    enabled: res.enabled,
    reservationId: res.reservationId,
    estimatedPoints: milliToPoints(res.estimatedMilliUnits),
  };
}

/** تثبيت الحجز (capture) + توزيع الاستهلاك على الـBuckets. */
export async function captureReservation(input: {
  userId: string;
  reservationId: string | null;
  actualPoints?: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!input.reservationId) return;
  const actualMilli =
    input.actualPoints != null ? Number(pointsToMilli(input.actualPoints)) : undefined;
  // captureUsageCredits يستهلك الـBuckets ذرّيًا داخل معاملته (لا توزيع منفصل).
  await captureUsageCredits({
    reservationId: input.reservationId,
    actualMilliUnits: actualMilli,
    referenceId: input.referenceId,
    metadata: input.metadata,
  });
}

/** تحرير الحجز عند الفشل/الحجب (release). */
export async function releaseReservation(reservationId: string | null): Promise<void> {
  await releaseUsageCredits(reservationId);
}

/** منح نقاط بمصدر مستقل (Bucket). */
export async function grantCredits(input: {
  userId: string;
  points: number;
  sourceType: CreditSourceType;
  sourceReferenceId?: string;
  expiresAt?: Date | null;
  priority?: number;
  idempotencyKey: string;
  description?: string;
}): Promise<number> {
  const granted = await grantUsageCreditsToBucket({
    userId: input.userId,
    milliUnits: Number(pointsToMilli(input.points)),
    sourceType: input.sourceType,
    sourceReferenceId: input.sourceReferenceId,
    expiresAt: input.expiresAt,
    priority: input.priority,
    idempotencyKey: input.idempotencyKey,
    description: input.description,
  });
  return milliToPoints(granted);
}

/** استرداد: منح نقاط بمصدر REFUND (لعكس خصم بعد استرداد دفع). */
export async function refundCredits(input: {
  userId: string;
  points: number;
  sourceReferenceId?: string;
  idempotencyKey: string;
  description?: string;
}): Promise<number> {
  return grantCredits({
    userId: input.userId,
    points: input.points,
    sourceType: "REFUND",
    sourceReferenceId: input.sourceReferenceId,
    idempotencyKey: input.idempotencyKey,
    description: input.description ?? "استرداد نقاط",
  });
}

/** تعديل إداري (+/-) بالنقاط. سبب إلزامي. */
export async function adjustCredits(input: {
  userId: string;
  points: number; // موجب أو سالب
  actorId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<void> {
  const milli =
    input.points >= 0
      ? Number(pointsToMilli(input.points))
      : -Number(pointsToMilli(Math.abs(input.points)));
  await adjustUsageCredits({
    userId: input.userId,
    amountMilliUnits: milli,
    actorId: input.actorId,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
  });
}

/** انتهاء الأرصدة المنتهية (مهمة دورية). يعيد النقاط المنتهية. */
export async function expireCredits(userId?: string): Promise<number> {
  const milli = await expireBuckets(userId);
  return milliToWholePoints(milli);
}

/** مولّد مفتاح idempotency للطلبات. */
export function newIdempotencyKey(prefix = "ik"): string {
  return newId(prefix);
}
