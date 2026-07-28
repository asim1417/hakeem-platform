export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
  limit: number;
  resetAt: Date;
}

export interface RateLimiter {
  consume(input: {
    key: string;
    scope: string;
    limit: number;
    windowSeconds: number;
  }): Promise<RateLimitDecision>;
}
