/**
 * حد معدّل رفع المرفقات — واجهة موحّدة.
 *
 * - InMemory: تطوير واختبارات فقط.
 * - PrismaDistributed: يعتمد جدول generic_rate_limit_windows (نفس أسلوب ApiRequestWindow).
 *
 * إنتاج V2 يتطلّب HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED=1 ومزوّدًا يعمل.
 */
import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec: number;
  limit: number;
  provider: "memory" | "prisma" | "fail-open" | "fail-closed";
};

export interface AttachmentUploadRateLimiter {
  consume(key: string): Promise<RateLimitResult>;
}

type MemoryBucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, MemoryBucket>();

export class InMemoryAttachmentUploadRateLimiter implements AttachmentUploadRateLimiter {
  constructor(
    private limit = Number(process.env.ATTACHMENT_UPLOAD_RATE_LIMIT || 40),
    private windowMs = 60_000
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const k = `att-upload:${key}`;
    let b = memoryBuckets.get(k);
    if (!b || now >= b.resetAt) {
      b = { count: 0, resetAt: now + this.windowMs };
      memoryBuckets.set(k, b);
    }
    b.count += 1;
    if (b.count > this.limit) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
        limit: this.limit,
        provider: "memory",
      };
    }
    return { allowed: true, retryAfterSec: 0, limit: this.limit, provider: "memory" };
  }
}

/**
 * موزّع عبر PostgreSQL — UPSERT ذرّي على مفتاح نصي (userId أو userId+ipHash).
 * Fail-open اختياري عند تعطل الجدول (موثّق).
 */
export class PrismaAttachmentUploadRateLimiter implements AttachmentUploadRateLimiter {
  constructor(
    private limit = Number(process.env.ATTACHMENT_UPLOAD_RATE_LIMIT || 40),
    private failOpen = (process.env.ATTACHMENT_RATE_LIMIT_FAIL_OPEN || "0") === "1"
  ) {}

  async consume(key: string): Promise<RateLimitResult> {
    const windowStart = Math.floor(Date.now() / 60_000);
    const bucketKey = `att-upload:${key}`;
    try {
      // جدول اختياري — يُنشأ بسكربت apply؛ عند الغياب نرمي
      const rows = await prisma.$queryRaw<Array<{ count: number }>>`
        INSERT INTO generic_rate_limit_windows (id, bucket_key, window_start, count, created_at)
        VALUES (${`rl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`}, ${bucketKey}, ${windowStart}, 1, NOW())
        ON CONFLICT (bucket_key, window_start)
        DO UPDATE SET count = generic_rate_limit_windows.count + 1
        RETURNING count
      `;
      const count = Number(rows[0]?.count ?? 1);
      if (count > this.limit) {
        return {
          allowed: false,
          retryAfterSec: Math.max(1, 60 - (Math.floor(Date.now() / 1000) % 60)),
          limit: this.limit,
          provider: "prisma",
        };
      }
      return { allowed: true, retryAfterSec: 0, limit: this.limit, provider: "prisma" };
    } catch {
      if (this.failOpen) {
        return { allowed: true, retryAfterSec: 0, limit: this.limit, provider: "fail-open" };
      }
      return {
        allowed: false,
        retryAfterSec: 30,
        limit: this.limit,
        provider: "fail-closed",
      };
    }
  }
}

export function isAttachmentRateLimitDistributedEnabled(): boolean {
  const v = (process.env.HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production" ||
    (process.env.HAKEEM_FORCE_PRODUCTION_GUARDS || "").trim() === "1"
  );
}

/**
 * هل يُسمح بمسار V2 للرفع في هذه البيئة؟
 * إنتاج بلا limiter موزّع → ممنوع.
 */
export function assertAttachmentsV2RateLimitReady(): {
  ok: boolean;
  code?: string;
  message?: string;
} {
  if (!isProductionRuntime()) return { ok: true };
  if (!isAttachmentRateLimitDistributedEnabled()) {
    return {
      ok: false,
      code: "RATE_LIMITER_NOT_PRODUCTION_READY",
      message:
        "ATTACHMENTS_V2 الإنتاجي يتطلّب HAKEEM_ATTACHMENT_RATE_LIMIT_DISTRIBUTED=1 ومزود Prisma. الذاكرة الداخلية للتطوير فقط.",
    };
  }
  return { ok: true };
}

let singleton: AttachmentUploadRateLimiter | null = null;

export function getAttachmentUploadRateLimiter(): AttachmentUploadRateLimiter {
  if (singleton) return singleton;
  if (isAttachmentRateLimitDistributedEnabled()) {
    singleton = new PrismaAttachmentUploadRateLimiter();
  } else {
    singleton = new InMemoryAttachmentUploadRateLimiter();
  }
  return singleton;
}

export function __setAttachmentUploadRateLimiterForTests(
  limiter: AttachmentUploadRateLimiter | null
): void {
  singleton = limiter;
}

export function __resetAttachmentUploadRateLimitForTests(): void {
  memoryBuckets.clear();
  singleton = new InMemoryAttachmentUploadRateLimiter();
}

/** مفتاح يشمل userId و可选 IP hash دون تخزين IP صريح */
export function buildAttachmentUploadRateKey(userId: string, ipHash?: string | null): string {
  return ipHash ? `${userId}:${ipHash}` : userId;
}

/**
 * توافق خلفي متزامن للاختبارات القديمة.
 * @deprecated استخدم getAttachmentUploadRateLimiter().consume
 */
export function consumeAttachmentUploadRateLimit(
  userId: string,
  limit = Number(process.env.ATTACHMENT_UPLOAD_RATE_LIMIT || 40),
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number; limit: number } {
  const now = Date.now();
  const key = `att-upload:${userId}`;
  let b = memoryBuckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    memoryBuckets.set(key, b);
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
