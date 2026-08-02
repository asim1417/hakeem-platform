import "server-only";

// حارس خدمات الذكاء — HKM-BILLING-UX-001 (§6/§14). يوحّد: تحديد المعدّل + حجز/تثبيت النقاط.
// no-op آمن عند إطفاء CREDITS_ENFORCEMENT_ENABLED أو usage_credits_v2 (لا يكسر المسارات القائمة).
// النمط: const g = await guardAiService(...); if(!g.allowed) return 402/429; ... ثم g.settle() أو g.release().

import {
  reserveCredits,
  captureReservation,
  releaseReservation,
  estimateServiceCost,
  type DocumentTier,
} from "@/lib/modules/billing/credit-engine";
import { usageCreditsEnabled } from "@/lib/modules/credits/usage-ledger";
import { rateLimitWindowStart } from "@/lib/modules/billing/rate-window";
import { newIdempotencyKey } from "@/lib/modules/billing/credit-engine";
import { resolveWalletOwner } from "@/lib/modules/billing/workspace";

export function creditsEnforcementEnabled(): boolean {
  return /^(1|true|on)$/i.test(process.env.CREDITS_ENFORCEMENT_ENABLED || "");
}

export interface GuardResult {
  allowed: boolean;
  reason?: "rate_limited" | "insufficient_credits";
  message?: string;
  retryAfterSec?: number;
  estimatedPoints?: number;
  reservationId?: string | null;
  /** ثبّت الخصم بعد النجاح (idempotent عبر الحجز). */
  settle: (actualPoints?: number, referenceId?: string) => Promise<void>;
  /** حرّر الحجز عند الفشل/الحجب (لا خصم). */
  release: () => Promise<void>;
}

const NOOP_SETTLE = async (): Promise<void> => {};

/** تحديد المعدّل (نافذة ثابتة عبر generic_rate_limit_windows). */
async function checkRateLimit(
  bucketKey: string,
  limit: number,
  windowSec: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = rateLimitWindowStart(nowSec, windowSec);
    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `INSERT INTO "generic_rate_limit_windows" ("id","bucket_key","window_start","count")
       VALUES ($1,$2,$3,1)
       ON CONFLICT ("bucket_key","window_start")
       DO UPDATE SET "count" = "generic_rate_limit_windows"."count" + 1
       RETURNING "count"`,
      newIdempotencyKey("grl"),
      bucketKey,
      windowStart
    );
    const count = Number(rows[0]?.count ?? 1);
    if (count > limit) {
      const retryAfterSec = windowStart + windowSec - nowSec;
      return { allowed: false, retryAfterSec: Math.max(1, retryAfterSec) };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    // فشل البنية → لا نحجب (fail-open للحد المعدّل فقط).
    return { allowed: true, retryAfterSec: 0 };
  }
}

export interface GuardOptions {
  userId: string;
  serviceCode: string;
  quantity?: number;
  opus?: boolean;
  proExport?: boolean;
  documentTier?: DocumentTier;
  /** حد معدّل اختياري (عدد الطلبات لكل نافذة). */
  rateLimit?: { limit: number; windowSec: number };
  referenceId?: string;
  idempotencyKey?: string;
}

/**
 * يحمي خدمة ذكاء: تحديد المعدّل ثم حجز النقاط (عند تفعيل الإنفاذ).
 * عند إطفاء الإنفاذ: يمرّ (allowed) بلا حجز/خصم.
 */
export async function guardAiService(opts: GuardOptions): Promise<GuardResult> {
  // 1) تحديد المعدّل (يعمل دائمًا إن مُرِّر).
  if (opts.rateLimit) {
    const rl = await checkRateLimit(
      `ai:${opts.serviceCode}:${opts.userId}`,
      opts.rateLimit.limit,
      opts.rateLimit.windowSec
    );
    if (!rl.allowed) {
      return {
        allowed: false,
        reason: "rate_limited",
        retryAfterSec: rl.retryAfterSec,
        message: "تجاوزت حد الطلبات المسموح. حاول بعد قليل.",
        settle: NOOP_SETTLE,
        release: NOOP_SETTLE,
      };
    }
  }

  // 2) الإنفاذ (حجز النقاط) — فقط عند تفعيل العلمين.
  if (!creditsEnforcementEnabled() || !(await usageCreditsEnabled())) {
    return { allowed: true, reservationId: null, settle: NOOP_SETTLE, release: NOOP_SETTLE };
  }

  const idem = opts.idempotencyKey || newIdempotencyKey("svc");
  // محفظة الفريق: الأعضاء يستهلكون من محفظة مالك مساحة العمل (§4).
  const walletUserId = await resolveWalletOwner(opts.userId);
  const estimate = await estimateServiceCost(opts.serviceCode, {
    quantity: opts.quantity,
    opus: opts.opus,
    proExport: opts.proExport,
    documentTier: opts.documentTier,
  });

  try {
    const reservation = await reserveCredits({
      userId: walletUserId,
      serviceCode: opts.serviceCode,
      quantity: opts.quantity,
      idempotencyKey: idem,
      referenceId: opts.referenceId,
    });
    if (!reservation.enabled) {
      // العلم أُطفئ بين الفحصين — مرّ بلا خصم.
      return { allowed: true, reservationId: null, settle: NOOP_SETTLE, release: NOOP_SETTLE };
    }
    const reservationId = reservation.reservationId;
    return {
      allowed: true,
      estimatedPoints: reservation.estimatedPoints || estimate.points,
      reservationId,
      settle: async (actualPoints?: number, referenceId?: string) => {
        await captureReservation({
          userId: walletUserId,
          reservationId,
          actualPoints,
          referenceId: referenceId ?? opts.referenceId,
        });
      },
      release: async () => {
        await releaseReservation(reservationId);
      },
    };
  } catch (e) {
    const name = (e as Error)?.name || "";
    if (name === "UsageCreditsExhaustedError") {
      return {
        allowed: false,
        reason: "insufficient_credits",
        estimatedPoints: estimate.points,
        message: "رصيد النقاط غير كافٍ لتنفيذ هذه الخدمة.",
        settle: NOOP_SETTLE,
        release: NOOP_SETTLE,
      };
    }
    // خطأ غير متوقع → لا نكسر المسار.
    return { allowed: true, reservationId: null, settle: NOOP_SETTLE, release: NOOP_SETTLE };
  }
}
