import "server-only";

import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_USAGE_PRICES,
  USAGE_REWARDS,
  type UsageServiceCode,
} from "@/config/usage-credits";
import {
  allocateConsumption,
  type CreditBucketRow,
  type CreditSourceType,
} from "./bucket-allocation";
import { SEED_SERVICE_RATES } from "@/config/billing-plans";

type Tx = Prisma.TransactionClient;

export class UsageCreditsExhaustedError extends Error {
  constructor() {
    super("رصيد وحدات الاستخدام غير كافٍ.");
    this.name = "UsageCreditsExhaustedError";
  }
}

export interface UsageCreditStatus {
  enabled: boolean;
  unknown?: boolean;
  balanceMilliUnits: number;
  reservedMilliUnits: number;
  availableMilliUnits: number;
  ledger: Array<{
    id: string;
    amountMilliUnits: number;
    balanceAfterMilliUnits: number;
    source: string;
    description: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: Date;
  }>;
}

function id(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

export async function usageCreditsEnabled(): Promise<boolean> {
  if (/^(1|true|on)$/i.test(process.env.USAGE_CREDITS_V2 ?? "")) return true;
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ enabled: boolean }[]>(
      `SELECT enabled FROM "feature_toggles" WHERE key = 'usage_credits_v2' LIMIT 1`
    );
    return rows[0]?.enabled === true;
  } catch {
    return false;
  }
}

export async function getUsageServiceCost(
  serviceCode: UsageServiceCode,
  quantity = 1
): Promise<number> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<
      { milliUnits: bigint | number; unitSize: number; active: boolean }[]
    >(
      `SELECT "milliUnits", "unitSize", active
         FROM "usage_service_prices"
        WHERE "serviceCode" = $1 LIMIT 1`,
      serviceCode
    );
    const row = rows[0];
    if (row?.active) {
      return Math.max(1, Math.ceil(Math.max(0, quantity) / row.unitSize)) * Number(row.milliUnits);
    }
  } catch {
    // قبل الهجرة: نستخدم الكتالوج، لكن الإنفاذ نفسه يبقى متوقفًا.
  }
  const fallback = DEFAULT_USAGE_PRICES[serviceCode];
  if (fallback) {
    return Math.max(1, Math.ceil(Math.max(0, quantity) / fallback.unitSize)) * fallback.milliUnits;
  }
  // أكواد الأمر التنفيذي (ASK_SOURCED…) ليست في DEFAULT_USAGE_PRICES القديم؛
  // نسقط إلى كتالوج البذر بدل رمي TypeError صامت يتحوّل إلى fail-open في الحارس.
  const seed = SEED_SERVICE_RATES.find((s) => s.serviceCode === serviceCode);
  if (seed) {
    return Math.max(1, Math.ceil(Math.max(0, quantity) / 1)) * seed.points * 1000;
  }
  throw new Error(`سعر خدمة غير معروف: ${serviceCode}`);
}

export async function reserveUsageCredits(input: {
  userId: string;
  serviceCode: UsageServiceCode;
  quantity?: number;
  idempotencyKey: string;
  referenceId?: string;
  /** تجاوز المبلغ المُقدَّر (يشمل زيادات Opus/التصدير/الشرائح) — يُحجز الكامل مقدّمًا. */
  overrideMilliUnits?: number;
}): Promise<{ enabled: boolean; reservationId: string | null; estimatedMilliUnits: number }> {
  if (!(await usageCreditsEnabled())) {
    return { enabled: false, reservationId: null, estimatedMilliUnits: 0 };
  }
  await reconcileTrialRewards(input.userId);
  const estimatedMilliUnits =
    input.overrideMilliUnits && input.overrideMilliUnits > 0
      ? Math.floor(input.overrideMilliUnits)
      : await getUsageServiceCost(input.serviceCode, input.quantity);
  const { prisma } = await import("@/lib/prisma");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.$queryRawUnsafe<
      { id: string; estimatedMilliUnits: bigint | number }[]
    >(
      `SELECT id, "estimatedMilliUnits" FROM "usage_credit_reservations"
        WHERE "idempotencyKey" = $1 LIMIT 1`,
      input.idempotencyKey
    );
    if (existing[0]) {
      return {
        enabled: true,
        reservationId: existing[0].id,
        estimatedMilliUnits: Number(existing[0].estimatedMilliUnits),
      };
    }

    await ensureAccount(tx, input.userId);
    await expireHeldReservations(tx, input.userId);
    const account = await lockAccount(tx, input.userId);
    const concurrent = await tx.$queryRawUnsafe<
      { id: string; estimatedMilliUnits: bigint | number }[]
    >(
      `SELECT id, "estimatedMilliUnits" FROM "usage_credit_reservations"
        WHERE "idempotencyKey" = $1 LIMIT 1`,
      input.idempotencyKey
    );
    if (concurrent[0]) {
      return {
        enabled: true,
        reservationId: concurrent[0].id,
        estimatedMilliUnits: Number(concurrent[0].estimatedMilliUnits),
      };
    }
    if (Number(account.balanceMilliUnits) - Number(account.reservedMilliUnits) < estimatedMilliUnits) {
      throw new UsageCreditsExhaustedError();
    }

    const reservationId = id("ucr");
    await tx.$executeRawUnsafe(
      `INSERT INTO "usage_credit_reservations"
        (id, "userId", "serviceCode", "estimatedMilliUnits", "idempotencyKey", "referenceId", "expiresAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '15 minutes')`,
      reservationId,
      input.userId,
      input.serviceCode,
      estimatedMilliUnits,
      input.idempotencyKey,
      input.referenceId ?? null
    );
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_accounts"
          SET "reservedMilliUnits" = "reservedMilliUnits" + $2,
              version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = $1`,
      input.userId,
      estimatedMilliUnits
    );
    return { enabled: true, reservationId, estimatedMilliUnits };
  });
}

export async function captureUsageCredits(input: {
  reservationId: string | null;
  actualMilliUnits?: number;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!input.reservationId) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.$transaction(async (tx) => {
    const reservations = await tx.$queryRawUnsafe<
      {
        id: string;
        userId: string;
        serviceCode: string;
        estimatedMilliUnits: bigint | number;
        status: string;
        referenceId: string | null;
      }[]
    >(
      `SELECT id, "userId", "serviceCode", "estimatedMilliUnits", status, "referenceId"
         FROM "usage_credit_reservations" WHERE id = $1 FOR UPDATE`,
      input.reservationId
    );
    const reservation = reservations[0];
    if (!reservation || reservation.status === "captured") return;
    if (reservation.status !== "held") throw new Error("حجز وحدات الاستخدام غير صالح.");

    const account = await lockAccount(tx, reservation.userId);
    const estimated = Number(reservation.estimatedMilliUnits);
    const actual = Math.max(1, input.actualMilliUnits ?? estimated);
    const extra = Math.max(0, actual - estimated);
    if (Number(account.balanceMilliUnits) - Number(account.reservedMilliUnits) < extra) {
      throw new UsageCreditsExhaustedError();
    }
    const nextBalance = Number(account.balanceMilliUnits) - actual;

    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_accounts"
          SET "balanceMilliUnits" = "balanceMilliUnits" - $2,
              "reservedMilliUnits" = "reservedMilliUnits" - $3,
              "lifetimeDebitMilliUnits" = "lifetimeDebitMilliUnits" + $2,
              version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = $1`,
      reservation.userId,
      actual,
      estimated
    );
    await appendLedger(tx, {
      userId: reservation.userId,
      entryType: "debit",
      amountMilliUnits: -actual,
      balanceAfterMilliUnits: nextBalance,
      source: reservation.serviceCode,
      idempotencyKey: `capture:${reservation.id}`,
      referenceType: "service",
      referenceId: input.referenceId ?? reservation.referenceId ?? undefined,
      metadata: input.metadata,
    });
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_reservations"
          SET status = 'captured', "capturedMilliUnits" = $2,
              "referenceId" = COALESCE($3, "referenceId"), "updatedAt" = NOW()
        WHERE id = $1`,
      reservation.id,
      actual,
      input.referenceId ?? null
    );
    // توزيع المُستهلَك على الـBuckets ذرّيًا في نفس المعاملة (الأقرب انتهاءً أولًا).
    // يمنع انحراف الحساب عن الـBuckets وسحب الانتهاء لرصيد مُستهلَك (§مراجعة الصحّة).
    await consumeBucketsInTx(tx, reservation.userId, actual);
  });
  const reservationUser = await prisma.$queryRawUnsafe<{ userId: string }[]>(
    `SELECT "userId" FROM "usage_credit_reservations" WHERE id = $1 LIMIT 1`,
    input.reservationId
  );
  if (reservationUser[0]) {
    const { evaluateUsageReferral } = await import("@/lib/modules/referrals/usage-referrals");
    await evaluateUsageReferral(reservationUser[0].userId).catch(() => false);
  }
}

export async function releaseUsageCredits(reservationId: string | null): Promise<void> {
  if (!reservationId) return;
  const { prisma } = await import("@/lib/prisma");
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRawUnsafe<
      { userId: string; estimatedMilliUnits: bigint | number; status: string }[]
    >(
      `SELECT "userId", "estimatedMilliUnits", status
         FROM "usage_credit_reservations" WHERE id = $1 FOR UPDATE`,
      reservationId
    );
    const row = rows[0];
    if (!row || row.status !== "held") return;
    await lockAccount(tx, row.userId);
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_accounts"
          SET "reservedMilliUnits" = GREATEST(0, "reservedMilliUnits" - $2),
              version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = $1`,
      row.userId,
      Number(row.estimatedMilliUnits)
    );
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_reservations" SET status = 'released', "updatedAt" = NOW() WHERE id = $1`,
      reservationId
    );
  });
}

export async function grantUsageReward(input: {
  userId: string;
  rewardCode: keyof typeof USAGE_REWARDS;
  sourceId?: string;
}): Promise<number> {
  const amount = USAGE_REWARDS[input.rewardCode];
  const idem = `reward:${input.rewardCode}:${input.userId}:${input.sourceId ?? "self"}`;
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    const prior = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" WHERE "idempotencyKey" = $1 LIMIT 1`,
      idem
    );
    if (prior[0]) return 0;
    await ensureAccount(tx, input.userId);
    const account = await lockAccount(tx, input.userId);
    const concurrent = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" WHERE "idempotencyKey" = $1 LIMIT 1`,
      idem
    );
    if (concurrent[0]) return 0;
    const nextBalance = Number(account.balanceMilliUnits) + amount;
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_accounts"
          SET "balanceMilliUnits" = "balanceMilliUnits" + $2,
              "lifetimeCreditMilliUnits" = "lifetimeCreditMilliUnits" + $2,
              version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = $1`,
      input.userId,
      amount
    );
    // Bucket مقابل للمكافأة (يحافظ على تطابق الحساب مع مجموع الـBuckets).
    await insertBucketInTx(tx, {
      userId: input.userId,
      amount,
      sourceType: "PROMOTION",
      sourceReferenceId: input.sourceId ?? input.rewardCode,
      priority: 150,
    });
    await appendLedger(tx, {
      userId: input.userId,
      entryType: "credit",
      amountMilliUnits: amount,
      balanceAfterMilliUnits: nextBalance,
      source: input.rewardCode,
      idempotencyKey: idem,
      referenceType: "reward",
      referenceId: input.sourceId,
    });
    return amount;
  });
}

export async function adjustUsageCredits(input: {
  userId: string;
  amountMilliUnits: number;
  actorId: string;
  reason: string;
  idempotencyKey: string;
}): Promise<void> {
  if (!input.amountMilliUnits) throw new Error("قيمة التعديل مطلوبة.");
  const { prisma } = await import("@/lib/prisma");
  await prisma.$transaction(async (tx) => {
    const prior = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" WHERE "idempotencyKey" = $1 LIMIT 1`,
      input.idempotencyKey
    );
    if (prior[0]) return;
    await ensureAccount(tx, input.userId);
    const account = await lockAccount(tx, input.userId);
    const concurrent = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" WHERE "idempotencyKey" = $1 LIMIT 1`,
      input.idempotencyKey
    );
    if (concurrent[0]) return;
    const nextBalance = Number(account.balanceMilliUnits) + input.amountMilliUnits;
    if (nextBalance < Number(account.reservedMilliUnits) || nextBalance < 0) {
      throw new UsageCreditsExhaustedError();
    }
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_accounts"
          SET "balanceMilliUnits" = "balanceMilliUnits" + $2,
              "lifetimeCreditMilliUnits" = "lifetimeCreditMilliUnits" + GREATEST($2,0),
              "lifetimeDebitMilliUnits" = "lifetimeDebitMilliUnits" + GREATEST(-$2,0),
              version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = $1`,
      input.userId,
      input.amountMilliUnits
    );
    // مزامنة الـBuckets: موجب ينشئ bucket إداري، سالب يستهلك من الـBuckets.
    if (input.amountMilliUnits > 0) {
      await insertBucketInTx(tx, {
        userId: input.userId,
        amount: input.amountMilliUnits,
        sourceType: "ADMIN_GRANT",
        sourceReferenceId: input.actorId,
        priority: 120,
      });
    } else if (input.amountMilliUnits < 0) {
      await consumeBucketsInTx(tx, input.userId, -input.amountMilliUnits);
    }
    await appendLedger(tx, {
      userId: input.userId,
      entryType: "adjustment",
      amountMilliUnits: input.amountMilliUnits,
      balanceAfterMilliUnits: nextBalance,
      source: "admin_adjustment",
      description: input.reason,
      idempotencyKey: input.idempotencyKey,
      referenceType: "admin",
      referenceId: input.actorId,
    });
  });
}

export async function reconcileTrialRewards(userId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const users = await prisma.$queryRawUnsafe<
      { phoneVerified: boolean; onboardingCompleted: boolean }[]
    >(
      `SELECT "phoneVerified", "onboardingCompleted" FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    const user = users[0];
    if (!user) return;
    // الدخول الحالي عبر Clerk/OAuth يثبت البريد؛ مكافأة التواصل تنتظر OTP الجوال.
    if (user.phoneVerified) {
      await grantUsageReward({ userId, rewardCode: "verified_contact" });
    }
    if (user.onboardingCompleted) {
      await grantUsageReward({ userId, rewardCode: "profile_completed" });
    }
    const ready = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "attachments"
        WHERE "processingStatus" = 'READY'
          AND metadata->>'uploadedBy' = $1
        ORDER BY "createdAt" ASC LIMIT 1`,
      userId
    );
    if (ready[0]) {
      await grantUsageReward({
        userId,
        rewardCode: "first_document_indexed",
        sourceId: "first-indexed-document",
      });
    }
  } catch {
    // قبل الهجرة/في الرولأوت: لا تعطيل للخدمة.
  }
}

export async function getUsageCreditStatus(userId: string, limit = 100): Promise<UsageCreditStatus> {
  const enabled = await usageCreditsEnabled();
  try {
    await reconcileTrialRewards(userId);
    const { prisma } = await import("@/lib/prisma");
    const accounts = await prisma.$queryRawUnsafe<
      { balanceMilliUnits: bigint | number; reservedMilliUnits: bigint | number }[]
    >(
      `SELECT "balanceMilliUnits", "reservedMilliUnits"
         FROM "usage_credit_accounts" WHERE "userId" = $1 LIMIT 1`,
      userId
    );
    const account = accounts[0] ?? { balanceMilliUnits: 0, reservedMilliUnits: 0 };
    const ledger = await prisma.$queryRawUnsafe<
      Array<{
        id: string;
        amountMilliUnits: bigint | number;
        balanceAfterMilliUnits: bigint | number;
        source: string;
        description: string | null;
        referenceType: string | null;
        referenceId: string | null;
        createdAt: Date;
      }>
    >(
      `SELECT id, "amountMilliUnits", "balanceAfterMilliUnits", source, description,
              "referenceType", "referenceId", "createdAt"
         FROM "usage_credit_ledger"
        WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
      userId,
      limit
    );
    const balance = Number(account.balanceMilliUnits);
    const reserved = Number(account.reservedMilliUnits);
    return {
      enabled,
      balanceMilliUnits: balance,
      reservedMilliUnits: reserved,
      availableMilliUnits: balance - reserved,
      ledger: ledger.map((row) => ({
        ...row,
        amountMilliUnits: Number(row.amountMilliUnits),
        balanceAfterMilliUnits: Number(row.balanceAfterMilliUnits),
      })),
    };
  } catch {
    return {
      enabled,
      unknown: true,
      balanceMilliUnits: 0,
      reservedMilliUnits: 0,
      availableMilliUnits: 0,
      ledger: [],
    };
  }
}

// ════════════════════════════════════════════════════════════════════
//  طبقة Buckets — HKM-BILLING-UX-001 (§4/§5). إضافية فوق المحرك المُثبَت.
//  المحفظة (usage_credit_accounts) تبقى مصدر الإنفاذ؛ الـBuckets للمصدر/الانتهاء.
// ════════════════════════════════════════════════════════════════════

/** إدراج Bucket داخل معاملة قائمة (يُستخدم من كل مسارات المنح لضمان التطابق). */
async function insertBucketInTx(
  tx: Tx,
  input: {
    userId: string;
    amount: number;
    sourceType: CreditSourceType;
    sourceReferenceId?: string | null;
    expiresAt?: Date | null;
    priority?: number;
  }
): Promise<string> {
  const bucketId = id("ucb");
  await tx.$executeRawUnsafe(
    `INSERT INTO "usage_credit_buckets"
      (id, "userId", "sourceType", "sourceReferenceId", "grantedMilliUnits",
       "remainingMilliUnits", status, "startsAt", "expiresAt", priority)
     VALUES ($1,$2,$3,$4,$5,$5,'active',NOW(),$6,$7)`,
    bucketId,
    input.userId,
    input.sourceType,
    input.sourceReferenceId ?? null,
    Math.max(0, Math.floor(input.amount)),
    input.expiresAt ?? null,
    input.priority ?? 100
  );
  return bucketId;
}

/** منح رصيد بمصدر مستقل (Bucket) + رفع رصيد المحفظة + قيد دفتر. idempotent. */
export async function grantUsageCreditsToBucket(input: {
  userId: string;
  milliUnits: number;
  sourceType: CreditSourceType;
  sourceReferenceId?: string;
  expiresAt?: Date | null;
  priority?: number;
  idempotencyKey: string;
  description?: string;
}): Promise<number> {
  const amount = Math.max(0, Math.floor(input.milliUnits));
  if (amount <= 0) return 0;
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    const prior = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" WHERE "idempotencyKey" = $1 LIMIT 1`,
      input.idempotencyKey
    );
    if (prior[0]) return 0;
    await ensureAccount(tx, input.userId);
    const account = await lockAccount(tx, input.userId);
    const concurrent = await tx.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "usage_credit_ledger" WHERE "idempotencyKey" = $1 LIMIT 1`,
      input.idempotencyKey
    );
    if (concurrent[0]) return 0;

    const bucketId = await insertBucketInTx(tx, {
      userId: input.userId,
      amount,
      sourceType: input.sourceType,
      sourceReferenceId: input.sourceReferenceId ?? null,
      expiresAt: input.expiresAt ?? null,
      priority: input.priority,
    });
    const nextBalance = Number(account.balanceMilliUnits) + amount;
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_accounts"
          SET "balanceMilliUnits" = "balanceMilliUnits" + $2,
              "lifetimeCreditMilliUnits" = "lifetimeCreditMilliUnits" + $2,
              version = version + 1, "updatedAt" = NOW()
        WHERE "userId" = $1`,
      input.userId,
      amount
    );
    await appendLedger(tx, {
      userId: input.userId,
      entryType: "credit",
      amountMilliUnits: amount,
      balanceAfterMilliUnits: nextBalance,
      source: `grant:${input.sourceType}`,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      referenceType: "bucket",
      referenceId: bucketId,
    });
    return amount;
  });
}

/** توزيع مبلغ مُستهلَك على الـBuckets داخل معاملة قائمة (الأقرب انتهاءً أولًا). */
async function consumeBucketsInTx(tx: Tx, userId: string, milliUnits: number): Promise<void> {
  const amount = Math.max(0, Math.floor(milliUnits));
  if (amount <= 0) return;
  const rows = await tx.$queryRawUnsafe<
    {
      id: string;
      sourceType: CreditSourceType;
      remainingMilliUnits: bigint | number;
      expiresAt: Date | null;
      priority: number;
      createdAt: Date;
    }[]
  >(
    `SELECT id, "sourceType", "remainingMilliUnits", "expiresAt", priority, "createdAt"
       FROM "usage_credit_buckets"
      WHERE "userId" = $1 AND status = 'active' AND "remainingMilliUnits" > 0
      FOR UPDATE`,
    userId
  );
  if (!rows.length) return;
  const buckets: CreditBucketRow[] = rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType,
    remainingMilliUnits: Number(r.remainingMilliUnits),
    expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
    priority: Number(r.priority),
    createdAt: new Date(r.createdAt),
  }));
  const { allocations } = allocateConsumption(buckets, amount);
  for (const a of allocations) {
    await tx.$executeRawUnsafe(
      `UPDATE "usage_credit_buckets"
          SET "remainingMilliUnits" = GREATEST(0, "remainingMilliUnits" - $2),
              status = CASE WHEN "remainingMilliUnits" - $2 <= 0 THEN 'depleted' ELSE status END,
              "updatedAt" = NOW()
        WHERE id = $1`,
      a.bucketId,
      a.amount
    );
  }
}

/**
 * توزيع مبلغ مُستهلَك على الـBuckets (يفتح معاملة). للاستخدام الخارجي/المصالحة.
 * ملاحظة: مسار capture الآن يستهلك الـBuckets داخل معاملته نفسها (ذرّيًا).
 */
export async function consumeBucketsFor(userId: string, milliUnits: number): Promise<void> {
  const amount = Math.max(0, Math.floor(milliUnits));
  if (amount <= 0) return;
  const { prisma } = await import("@/lib/prisma");
  try {
    await prisma.$transaction((tx) => consumeBucketsInTx(tx, userId, amount));
  } catch {
    // best-effort للمصالحة؛ لا نكسر المسار.
  }
}

/** انتهاء الأرصدة المنتهية: خفض المحفظة + قيد دفتر + إغلاق الـBucket. */
export async function expireBuckets(userId?: string): Promise<number> {
  const { prisma } = await import("@/lib/prisma");
  let totalExpired = 0;
  try {
    const targets = await prisma.$queryRawUnsafe<{ userId: string; id: string; remainingMilliUnits: bigint | number }[]>(
      userId
        ? `SELECT "userId", id, "remainingMilliUnits" FROM "usage_credit_buckets"
             WHERE status = 'active' AND "expiresAt" IS NOT NULL AND "expiresAt" <= NOW()
               AND "remainingMilliUnits" > 0 AND "userId" = $1`
        : `SELECT "userId", id, "remainingMilliUnits" FROM "usage_credit_buckets"
             WHERE status = 'active' AND "expiresAt" IS NOT NULL AND "expiresAt" <= NOW()
               AND "remainingMilliUnits" > 0`,
      ...(userId ? [userId] : [])
    );
    for (const t of targets) {
      const amt = Number(t.remainingMilliUnits);
      if (amt <= 0) continue;
      await prisma.$transaction(async (tx) => {
        // إغلاق ذرّي للـBucket (يمنع الازدواج عبر شرط status).
        const closed = await tx.$executeRawUnsafe(
          `UPDATE "usage_credit_buckets"
              SET "remainingMilliUnits" = 0, status = 'expired', "updatedAt" = NOW()
            WHERE id = $1 AND status = 'active'`,
          t.id
        );
        if (!closed) return;
        const account = await lockAccount(tx, t.userId);
        // القصّ إلى المتاح (balance − reserved) لا الرصيد كله — يتجنّب انتهاك CHECK(reserved<=balance)
        // ويمنع سحب رصيد يخصّ مصدرًا آخر ما زال محجوزًا.
        const available = Number(account.balanceMilliUnits) - Number(account.reservedMilliUnits);
        const reduce = Math.min(amt, Math.max(0, available));
        if (reduce <= 0) return;
        const nextBalance = Number(account.balanceMilliUnits) - reduce;
        await tx.$executeRawUnsafe(
          `UPDATE "usage_credit_accounts"
              SET "balanceMilliUnits" = "balanceMilliUnits" - $2,
                  "lifetimeDebitMilliUnits" = "lifetimeDebitMilliUnits" + $2,
                  version = version + 1, "updatedAt" = NOW()
            WHERE "userId" = $1`,
          t.userId,
          reduce
        );
        await appendLedger(tx, {
          userId: t.userId,
          entryType: "adjustment",
          amountMilliUnits: -reduce,
          balanceAfterMilliUnits: nextBalance,
          source: "expire",
          idempotencyKey: `expire:${t.id}`,
          referenceType: "bucket",
          referenceId: t.id,
        });
        totalExpired += reduce;
      });
    }
  } catch {
    /* best-effort */
  }
  return totalExpired;
}

/** قراءة أرصدة المستخدم (للملخّص والتوزيع). */
export async function getUserBuckets(userId: string): Promise<CreditBucketRow[]> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<
      {
        id: string;
        sourceType: CreditSourceType;
        remainingMilliUnits: bigint | number;
        expiresAt: Date | null;
        priority: number;
        createdAt: Date;
      }[]
    >(
      `SELECT id, "sourceType", "remainingMilliUnits", "expiresAt", priority, "createdAt"
         FROM "usage_credit_buckets"
        WHERE "userId" = $1 AND status = 'active' AND "remainingMilliUnits" > 0
        ORDER BY ("expiresAt" IS NULL), "expiresAt" ASC, priority DESC, "createdAt" ASC`,
      userId
    );
    return rows.map((r) => ({
      id: r.id,
      sourceType: r.sourceType,
      remainingMilliUnits: Number(r.remainingMilliUnits),
      expiresAt: r.expiresAt ? new Date(r.expiresAt) : null,
      priority: Number(r.priority),
      createdAt: new Date(r.createdAt),
    }));
  } catch {
    return [];
  }
}

async function ensureAccount(tx: Tx, userId: string): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO "usage_credit_accounts" ("userId") VALUES ($1)
     ON CONFLICT ("userId") DO NOTHING`,
    userId
  );
}

async function lockAccount(
  tx: Tx,
  userId: string
): Promise<{ balanceMilliUnits: bigint | number; reservedMilliUnits: bigint | number }> {
  const rows = await tx.$queryRawUnsafe<
    { balanceMilliUnits: bigint | number; reservedMilliUnits: bigint | number }[]
  >(
    `SELECT "balanceMilliUnits", "reservedMilliUnits"
       FROM "usage_credit_accounts" WHERE "userId" = $1 FOR UPDATE`,
    userId
  );
  if (!rows[0]) throw new Error("تعذر إنشاء حساب وحدات الاستخدام.");
  return rows[0];
}

async function expireHeldReservations(tx: Tx, userId: string): Promise<void> {
  const expired = await tx.$queryRawUnsafe<{ estimatedMilliUnits: bigint | number }[]>(
    `SELECT "estimatedMilliUnits"
       FROM "usage_credit_reservations"
      WHERE "userId" = $1 AND status = 'held' AND "expiresAt" <= NOW()
      FOR UPDATE`,
    userId
  );
  const total = expired.reduce((sum, row) => sum + Number(row.estimatedMilliUnits), 0);
  if (!total) return;
  await tx.$executeRawUnsafe(
    `UPDATE "usage_credit_reservations"
        SET status = 'expired', "updatedAt" = NOW()
      WHERE "userId" = $1 AND status = 'held' AND "expiresAt" <= NOW()`,
    userId
  );
  await tx.$executeRawUnsafe(
    `UPDATE "usage_credit_accounts"
        SET "reservedMilliUnits" = GREATEST(0, "reservedMilliUnits" - $2),
            version = version + 1, "updatedAt" = NOW()
      WHERE "userId" = $1`,
    userId,
    total
  );
}

async function appendLedger(
  tx: Tx,
  input: {
    userId: string;
    entryType: "credit" | "debit" | "reversal" | "adjustment";
    amountMilliUnits: number;
    balanceAfterMilliUnits: number;
    source: string;
    description?: string;
    idempotencyKey: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const prior = await tx.$queryRawUnsafe<{ entryHash: string }[]>(
    `SELECT "entryHash" FROM "usage_credit_ledger"
      WHERE "userId" = $1 ORDER BY "createdAt" DESC, id DESC LIMIT 1`,
    input.userId
  );
  const previousHash = prior[0]?.entryHash ?? null;
  const createdAt = new Date();
  const payload = [
    previousHash ?? "",
    input.userId,
    input.entryType,
    input.amountMilliUnits,
    input.balanceAfterMilliUnits,
    input.source,
    input.idempotencyKey,
    createdAt.toISOString(),
  ].join("|");
  const entryHash = createHash("sha256").update(payload).digest("hex");
  await tx.$executeRawUnsafe(
    `INSERT INTO "usage_credit_ledger"
      (id, "userId", "entryType", "amountMilliUnits", "balanceAfterMilliUnits",
       source, description, "idempotencyKey", "referenceType", "referenceId",
       metadata, "previousHash", "entryHash", "createdAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
    id("ucl"),
    input.userId,
    input.entryType,
    input.amountMilliUnits,
    input.balanceAfterMilliUnits,
    input.source,
    input.description ?? null,
    input.idempotencyKey,
    input.referenceType ?? null,
    input.referenceId ?? null,
    JSON.stringify(input.metadata ?? {}),
    previousHash,
    entryHash,
    createdAt
  );
}
