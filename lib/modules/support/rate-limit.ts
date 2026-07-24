/**
 * حد معدّل خفيف لإرسال دعم العملاء — ذاكرة عملية (بدون migration).
 * نافذة ثابتة لكل مستخدم؛ عند إعادة تشغيل الحاوية تُصفَّر (مقبول لـ P0).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 20;
const DEFAULT_WINDOW_MS = 60_000;

/** يستهلك محاولة؛ يعيد allowed=false عند التجاوز. */
export function consumeSupportSendLimit(
  userId: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): { allowed: boolean; retryAfterSec: number; limit: number } {
  const now = Date.now();
  const key = `support-send:${userId}`;
  let b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
      limit,
    };
  }
  return { allowed: true, retryAfterSec: 0, limit };
}

/** للاختبارات فقط. */
export function __resetSupportRateLimitForTests(): void {
  buckets.clear();
}
