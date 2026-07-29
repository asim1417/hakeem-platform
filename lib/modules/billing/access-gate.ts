// ─────────────────────────────────────────────────────────────────────────────
// بوابة الوحدات المتقدّمة: حصّة مجانية أولًا، ثم نقاط عند النفاد (الخصم بعد النجاح).
// ─────────────────────────────────────────────────────────────────────────────
import { CREDIT_SPENDS } from "@/config/credits";
import { canConsume, consumeOne } from "@/lib/modules/billing/quota";
import { getBalance, spendCredits } from "@/lib/modules/credits/ledger";
import {
  UsageCreditsExhaustedError,
  captureUsageCredits,
  releaseUsageCredits,
  reserveUsageCredits,
  usageCreditsEnabled,
} from "@/lib/modules/credits/usage-ledger";
import type { UsageServiceCode } from "@/config/usage-credits";

export type AccessDecision =
  | {
      allowed: true;
      via: "usage" | "quota" | "credits" | "open";
      remaining?: number;
      reservationId?: string | null;
    }
  | { allowed: false; reason: "exhausted"; message: string };

/** هل يُسمح بالاستخدام؟ يتحقق من الحصّة أو كفاية النقاط دون خصم. */
export async function gateAdvancedUse(
  userId: string,
  options?: {
    serviceCode?: UsageServiceCode;
    quantity?: number;
    idempotencyKey?: string;
    referenceId?: string;
  }
): Promise<AccessDecision> {
  if (await usageCreditsEnabled()) {
    try {
      const held = await reserveUsageCredits({
        userId,
        serviceCode: options?.serviceCode ?? "ASK_HAKEEM",
        quantity: options?.quantity,
        idempotencyKey:
          options?.idempotencyKey ??
          `usage:${options?.serviceCode ?? "ASK_HAKEEM"}:${userId}:${Date.now()}`,
        referenceId: options?.referenceId,
      });
      return { allowed: true, via: "usage", reservationId: held.reservationId };
    } catch (error) {
      if (error instanceof UsageCreditsExhaustedError) {
        return {
          allowed: false,
          reason: "exhausted",
          message: "انتهى رصيد وحدات الاستخدام. أكمل خطوات التجربة أو اشحن باقة جديدة.",
        };
      }
      // علم v2 لا يُفعّل قبل الهجرة؛ عند خطأ غير متوقع لا نكسر المسار القديم.
    }
  }

  const quota = await canConsume(userId).catch(
    () => ({ allowed: true, remaining: -1, isSubscribed: false }) as const
  );
  if (quota.allowed) {
    return { allowed: true, via: quota.remaining === -1 ? "open" : "quota", remaining: quota.remaining };
  }

  const bal = await getBalance(userId);
  const need = CREDIT_SPENDS.advanced_use.points;
  if (bal >= need) {
    return { allowed: true, via: "credits", remaining: bal };
  }

  return {
    allowed: false,
    reason: "exhausted",
    message: "انتهى رصيدك المجاني ونقاطك غير كافية. اشترك أو أكمل ملفك لزيادة النقاط.",
  };
}

/** خصم بعد نجاح العملية: حصّة أو نقاط. */
export async function settleAdvancedUse(
  userId: string,
  via: "usage" | "quota" | "credits" | "open",
  options?: { reservationId?: string | null; actualMilliUnits?: number; referenceId?: string }
): Promise<void> {
  if (via === "usage") {
    await captureUsageCredits({
      reservationId: options?.reservationId ?? null,
      actualMilliUnits: options?.actualMilliUnits,
      referenceId: options?.referenceId,
    });
    return;
  }
  if (via === "quota") {
    await consumeOne(userId).catch(() => undefined);
    return;
  }
  if (via === "credits") {
    await spendCredits(userId, "advanced_use").catch(() => undefined);
  }
}

/** تحرير الحجز عند نتيجة محجوبة أو فشل معروف قبل النجاح. */
export async function releaseAdvancedUse(access: AccessDecision): Promise<void> {
  if (access.allowed && access.via === "usage") {
    await releaseUsageCredits(access.reservationId ?? null);
  }
}
