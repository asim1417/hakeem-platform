export class RateLimiter {
  private tokens: number;
  private lastRefillMs: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(ratePerMinute: number, burst = ratePerMinute) {
    this.capacity = Math.max(1, burst);
    this.tokens = this.capacity;
    this.lastRefillMs = Date.now();
    this.refillPerMs = Math.max(1, ratePerMinute) / 60_000;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillMs;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
    this.lastRefillMs = now;
  }

  tryRemoveToken(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  async removeToken(): Promise<void> {
    while (!this.tryRemoveToken()) {
      const missing = 1 - this.tokens;
      const waitMs = Math.max(25, Math.ceil(missing / this.refillPerMs));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
