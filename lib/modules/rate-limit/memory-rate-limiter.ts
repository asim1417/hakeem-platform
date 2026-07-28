import type { RateLimitDecision, RateLimiter } from "./types";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Rate limiter في ذاكرة العملية — مناسب للتطوير/نسخة واحدة.
 * للإنتاج متعدد النسخ استخدم RedisRateLimiter.
 */
export class MemoryRateLimiter implements RateLimiter {
  async consume(input: {
    key: string;
    scope: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitDecision> {
    const now = Date.now();
    const fullKey = `${input.scope}:${input.key}`;
    let b = buckets.get(fullKey);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + input.windowSeconds * 1000 };
      buckets.set(fullKey, b);
    }
    b.count += 1;
    if (b.count > input.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
        limit: input.limit,
        resetAt: new Date(b.resetAt)
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, input.limit - b.count),
      limit: input.limit,
      resetAt: new Date(b.resetAt)
    };
  }
}

export function __resetMemoryRateLimiterForTests(): void {
  buckets.clear();
}
