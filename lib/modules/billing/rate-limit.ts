import "server-only";

// حدّ معدّل مشترك (نافذة ثابتة عبر generic_rate_limit_windows) — HKM-BILLING-UX-001 (§14).
// يُستخدم لمسارات الدفع الحسّاسة (checkout/webhook/refund) وخدمات الذكاء.

import { randomBytes } from "crypto";
import { rateLimitWindowStart } from "@/lib/modules/billing/rate-window";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  count: number;
}

/**
 * يستهلك وحدة من نافذة الحدّ. allowed=false عند تجاوز limit.
 * fail-open عند غياب الجدول (لا نكسر المسار)، لكن استدعِه على المسارات الحسّاسة كطبقة إضافية.
 */
export async function enforceRateLimit(
  bucketKey: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const nowSec = Math.floor(Date.now() / 1000);
    const windowStart = rateLimitWindowStart(nowSec, windowSec);
    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      `INSERT INTO "generic_rate_limit_windows" ("id","bucket_key","window_start","count")
       VALUES ($1,$2,$3,1)
       ON CONFLICT ("bucket_key","window_start")
       DO UPDATE SET "count" = "generic_rate_limit_windows"."count" + 1
       RETURNING "count"`,
      `grl_${randomBytes(9).toString("hex")}`,
      bucketKey,
      windowStart
    );
    const count = Number(rows[0]?.count ?? 1);
    if (count > limit) {
      return { allowed: false, retryAfterSec: Math.max(1, windowStart + windowSec - nowSec), count };
    }
    return { allowed: true, retryAfterSec: 0, count };
  } catch {
    return { allowed: true, retryAfterSec: 0, count: 0 };
  }
}

/** مفتاح حدّ من طلب: يفضّل معرّف المستخدم، وإلا IP. */
export function rateLimitKeyFromRequest(
  scope: string,
  userId: string | null,
  request: { headers: { get(name: string): string | null } }
): string {
  if (userId) return `${scope}:u:${userId}`;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:ip:${ip}`;
}
