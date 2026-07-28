/**
 * حد معدّل خفيف في ذاكرة العملية لـ inspect/import URL.
 * في الإنتاج متعدد النسخ يُفضَّل Redis — موثَّق في pr2-known-limitations.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 30;
const DEFAULT_WINDOW_MS = 60_000;

export function consumeDirectUrlRateLimit(
  key: string,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS
): { allowed: boolean; retryAfterSec: number; limit: number } {
  const now = Date.now();
  const fullKey = `direct-url:${key}`;
  let b = buckets.get(fullKey);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(fullKey, b);
  }
  b.count += 1;
  if (b.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
      limit
    };
  }
  return { allowed: true, retryAfterSec: 0, limit };
}

export function __resetDirectUrlRateLimitForTests(): void {
  buckets.clear();
}
