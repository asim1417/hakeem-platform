// خوارزمية توزيع الاستهلاك على أرصدة المصادر (Buckets) — HKM-BILLING-UX-001 (§5).
// نقيّة (بلا قاعدة) لتُختبر بدقة: «استهلك الأقرب انتهاءً أولًا».
// القاعدة: expiresAt الأقرب أولًا (NULL = بلا انتهاء = أخيرًا)، ثم priority الأعلى، ثم الأقدم إنشاءً.

export type CreditSourceType =
  | "TRIAL"
  | "SUBSCRIPTION"
  | "PURCHASE"
  | "PROMOTION"
  | "REFUND"
  | "ADMIN_GRANT"
  | "LEGACY_MIGRATION";

export interface CreditBucketRow {
  id: string;
  sourceType: CreditSourceType;
  remainingMilliUnits: number;
  expiresAt: Date | null;
  priority: number;
  createdAt: Date;
}

export interface BucketAllocation {
  bucketId: string;
  amount: number; // milli-units مأخوذة من هذا الـbucket
}

export interface AllocationResult {
  allocations: BucketAllocation[];
  consumed: number; // الإجمالي المخصّص فعليًا
  shortfall: number; // ما تعذّر تغطيته (> 0 يعني رصيد غير كافٍ)
}

/** ترتيب الاستهلاك: الأقرب انتهاءً أولًا. */
export function sortBucketsForConsumption(buckets: CreditBucketRow[]): CreditBucketRow[] {
  return [...buckets].sort((a, b) => {
    const ax = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY;
    const bx = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY;
    if (ax !== bx) return ax - bx; // الأقرب انتهاءً أولًا
    if (a.priority !== b.priority) return b.priority - a.priority; // الأعلى أولوية أولًا
    return a.createdAt.getTime() - b.createdAt.getTime(); // الأقدم أولًا
  });
}

/**
 * توزيع مبلغ الاستهلاك على الـbuckets حسب ترتيب الأولوية.
 * لا يُنتج تخصيصًا سالبًا؛ يتوقّف عند تغطية المبلغ؛ يُبلّغ عن العجز إن وُجد.
 */
export function allocateConsumption(buckets: CreditBucketRow[], amount: number): AllocationResult {
  const target = Math.max(0, Math.floor(amount));
  const allocations: BucketAllocation[] = [];
  if (target === 0) return { allocations, consumed: 0, shortfall: 0 };

  let remaining = target;
  for (const b of sortBucketsForConsumption(buckets)) {
    if (remaining <= 0) break;
    const avail = Math.max(0, Math.floor(b.remainingMilliUnits));
    if (avail <= 0) continue;
    const take = Math.min(avail, remaining);
    allocations.push({ bucketId: b.id, amount: take });
    remaining -= take;
  }
  return { allocations, consumed: target - remaining, shortfall: remaining };
}

/** توزيع الرصيد المتبقّي حسب نوع المصدر (لبطاقة «توزيع الرصيد»). */
export function distributeBySource(buckets: CreditBucketRow[]): Record<CreditSourceType, number> {
  const out: Record<CreditSourceType, number> = {
    TRIAL: 0,
    SUBSCRIPTION: 0,
    PURCHASE: 0,
    PROMOTION: 0,
    REFUND: 0,
    ADMIN_GRANT: 0,
    LEGACY_MIGRATION: 0,
  };
  for (const b of buckets) {
    out[b.sourceType] = (out[b.sourceType] || 0) + Math.max(0, Math.floor(b.remainingMilliUnits));
  }
  return out;
}

/** مجموع الرصيد المتبقّي عبر كل الـbuckets. */
export function sumRemaining(buckets: CreditBucketRow[]): number {
  return buckets.reduce((s, b) => s + Math.max(0, Math.floor(b.remainingMilliUnits)), 0);
}
