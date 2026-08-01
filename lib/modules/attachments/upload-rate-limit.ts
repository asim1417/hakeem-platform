/**
 * حد معدّل لرفع المرفقات (ذاكرة العملية).
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function consumeAttachmentUploadRateLimit(
  userId: string,
  limit = Number(process.env.ATTACHMENT_UPLOAD_RATE_LIMIT || 40),
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number; limit: number } {
  const now = Date.now();
  const key = `att-upload:${userId}`;
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

export function __resetAttachmentUploadRateLimitForTests(): void {
  buckets.clear();
}
