import type { RateLimitDecision, RateLimiter } from "./types";

/**
 * هيكل Redis — يُفعَّل عند توفر REDIS_URL في الإنتاج.
 * حاليًا يرمي إن استُدعي دون تهيئة (لا يدّعي نجاحًا كاذبًا).
 */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redisUrl: string) {}

  async consume(_input: {
    key: string;
    scope: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitDecision> {
    void this.redisUrl;
    throw new Error("RedisRateLimiter غير مُنفَّذ بالكامل في هذه المرحلة — اضبط Memory أو وفّر عميل Redis لاحقًا.");
  }
}
