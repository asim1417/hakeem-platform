import { isDocumentRateLimitEnabled } from "@/lib/modules/documents/document-limits";
import { MemoryRateLimiter } from "./memory-rate-limiter";
import { RedisRateLimiter } from "./redis-rate-limiter";
import type { RateLimitDecision, RateLimiter } from "./types";

let singleton: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (singleton) return singleton;
  const redisUrl = process.env.REDIS_URL || process.env.DOCUMENT_REDIS_URL;
  if (redisUrl && process.env.DOCUMENT_RATE_LIMIT_BACKEND === "redis") {
    singleton = new RedisRateLimiter(redisUrl);
  } else {
    singleton = new MemoryRateLimiter();
  }
  return singleton;
}

/** للاختبارات */
export function __setRateLimiterForTests(limiter: RateLimiter | null): void {
  singleton = limiter;
}

export async function consumeDocumentRateLimit(input: {
  userId: string;
  scope: "upload" | "inspect-url" | "import-url";
  limit: number;
  windowSeconds: number;
  ipHash?: string;
}): Promise<RateLimitDecision | { skipped: true; allowed: true }> {
  if (!isDocumentRateLimitEnabled()) {
    return { skipped: true, allowed: true };
  }
  const key = input.ipHash ? `${input.userId}:${input.ipHash}` : input.userId;
  return getRateLimiter().consume({
    key,
    scope: `documents:${input.scope}`,
    limit: input.limit,
    windowSeconds: input.windowSeconds
  });
}

export type { RateLimitDecision, RateLimiter };
export { MemoryRateLimiter, __resetMemoryRateLimiterForTests } from "./memory-rate-limiter";
export { RedisRateLimiter } from "./redis-rate-limiter";
