// ─────────────────────────────────────────────────────────────────────────────
// بوابة الوحدات المتقدّمة: حصّة مجانية أولًا، ثم نقاط عند النفاد (الخصم بعد النجاح).
// ─────────────────────────────────────────────────────────────────────────────
import { CREDIT_SPENDS } from "@/config/credits";
import { canConsume, consumeOne } from "@/lib/modules/billing/quota";
import { getBalance, spendCredits } from "@/lib/modules/credits/ledger";

export type AccessDecision =
  | { allowed: true; via: "quota" | "credits" | "open"; remaining?: number }
  | { allowed: false; reason: "exhausted"; message: string };

/** هل يُسمح بالاستخدام؟ يتحقق من الحصّة أو كفاية النقاط دون خصم. */
export async function gateAdvancedUse(userId: string): Promise<AccessDecision> {
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
  via: "quota" | "credits" | "open"
): Promise<void> {
  if (via === "quota") {
    await consumeOne(userId).catch(() => undefined);
    return;
  }
  if (via === "credits") {
    await spendCredits(userId, "advanced_use").catch(() => undefined);
  }
}
