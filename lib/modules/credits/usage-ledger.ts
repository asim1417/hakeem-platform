import "server-only";

import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_USAGE_PRICES,
  USAGE_REWARDS,
  type UsageServiceCode,
} from "@/config/usage-credits";

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
  return Math.max(1, Math.ceil(Math.max(0, quantity) / fallback.unitSize)) * fallback.milliUnits;
}

export async function reserveUsageCredits(input: {
  userId: string;
  serviceCode: UsageServiceCode;
  quantity?: number;
  idempotencyKey: string;
  referenceId?: string;
}): Promise<{ enabled: boolean; reservationId: string | null; estimatedMilliUnits: number }> {
  if (!(await usageCreditsEnabled())) {
    return { enabled: false, reservationId: null, estimatedMilliUnits: 0 };
  }
  await reconcileTrialRewards(input.userId);
  const estimatedMilliUnits = await getUsageServiceCost(input.serviceCode, input.quantity);
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
