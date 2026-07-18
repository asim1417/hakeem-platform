// ─────────────────────────────────────────────────────────────────────────────
// دالّة الحصّة المركزية — مصدر حقيقةٍ واحد للاستحقاق (طبقةٌ فوق المصادقة، لا تمسّها).
//
// الأعمدة (freeQuotaUsed · freeQuotaTotal · subscriptionStatus) **خارج موديل Prisma**
// عمدًا — كي لا يُجبَر أيّ findUnique/findMany بلا select على SELECTها فيكسر على قاعدةٍ
// لم تُطبَّق عليها الهجرة. القراءة/الكتابة عبر SQL خام داخل try/catch:
//   • قبل الهجرة (لا أعمدة) → **سقوط مفتوح** (allowed=true) فلا يتعطّل أحد.
//   • الإنفاذ يُفعَّل تلقائيًّا بعد تطبيق الهجرة + ضبط FREE_QUOTA.
//
// القاعدة: الخصم مرّة واحدة بعد نجاح العملية فقط (consumeOne)، بزيادةٍ ذرّية تمنع التسابق.
// ─────────────────────────────────────────────────────────────────────────────
import { PRICING } from "@/config/pricing";

export interface QuotaRow {
  subscriptionStatus: string | null;
  freeQuotaUsed: number | null;
  freeQuotaTotal: number | null;
}
export interface QuotaDecision {
  allowed: boolean;
  remaining: number; // -1 = غير محدود (مشترك) أو غير معروف (قبل الهجرة)
  isSubscribed: boolean;
  reason?: "exhausted";
}

/** المنطق النقيّ (قابل للاختبار بلا قاعدة): يقرّر السماح من صفّ الحصّة + الإعداد. */
export function evaluateQuota(row: QuotaRow): QuotaDecision {
  const isSubscribed = row.subscriptionStatus === "active";
  if (isSubscribed) return { allowed: true, remaining: -1, isSubscribed: true };
  const total = row.freeQuotaTotal ?? PRICING.freeQuota; // null ⟶ الحصّة الافتراضية
  const used = row.freeQuotaUsed ?? 0;
  const remaining = Math.max(0, total - used);
  return remaining > 0
    ? { allowed: true, remaining, isSubscribed: false }
    : { allowed: false, remaining: 0, isSubscribed: false, reason: "exhausted" };
}

async function readRow(userId: string): Promise<QuotaRow | null> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRawUnsafe<QuotaRow[]>(
    `SELECT "subscriptionStatus", "freeQuotaUsed", "freeQuotaTotal" FROM "users" WHERE id = $1 LIMIT 1`,
    userId
  );
  return rows[0] ?? null;
}

/** هل يجوز الاستهلاك؟ سقوطٌ مفتوح (allowed) عند غياب الأعمدة/الخطأ — لا نحجب قبل الرولأوت. */
export async function canConsume(userId: string): Promise<QuotaDecision> {
  try {
    const row = await readRow(userId);
    if (!row) return { allowed: true, remaining: -1, isSubscribed: false };
    return evaluateQuota(row);
  } catch {
    return { allowed: true, remaining: -1, isSubscribed: false };
  }
}

/** خصمٌ ذرّيّ لاستخدامٍ واحد (بعد النجاح). لا يخصم للمشتركين. سقوطٌ آمن. */
export async function consumeOne(userId: string): Promise<{ remaining: number }> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ freeQuotaUsed: number; freeQuotaTotal: number | null }[]>(
      `UPDATE "users"
         SET "freeQuotaUsed" = "freeQuotaUsed" + 1
       WHERE id = $1 AND COALESCE("subscriptionStatus", 'free') <> 'active'
       RETURNING "freeQuotaUsed", "freeQuotaTotal"`,
      userId
    );
    if (!rows[0]) return { remaining: -1 }; // مشترك أو لا صفّ
    const total = rows[0].freeQuotaTotal ?? PRICING.freeQuota;
    return { remaining: Math.max(0, total - rows[0].freeQuotaUsed) };
  } catch {
    return { remaining: -1 };
  }
}

export interface QuotaStatus {
  total: number;
  used: number;
  remaining: number;
  isSubscribed: boolean;
  /** غير معروف (قبل الهجرة) — تُخفي الواجهة العدّاد حينها. */
  unknown?: boolean;
}

/** حالة العرض للواجهة (عدّاد الحصّة). */
export async function getStatus(userId: string): Promise<QuotaStatus> {
  try {
    const row = await readRow(userId);
    if (!row) return { total: PRICING.freeQuota, used: 0, remaining: PRICING.freeQuota, isSubscribed: false };
    const isSubscribed = row.subscriptionStatus === "active";
    const total = row.freeQuotaTotal ?? PRICING.freeQuota;
    const used = row.freeQuotaUsed ?? 0;
    return { total, used, remaining: Math.max(0, total - used), isSubscribed };
  } catch {
    return { total: PRICING.freeQuota, used: 0, remaining: PRICING.freeQuota, isSubscribed: false, unknown: true };
  }
}
