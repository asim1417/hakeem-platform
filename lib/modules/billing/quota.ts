// ─────────────────────────────────────────────────────────────────────────────
// دالّة الحصّة المركزية — مصدر حقيقةٍ واحد للاستحقاق (طبقةٌ فوق المصادقة، لا تمسّها).
//
// الأعمدة (freeQuotaUsed · freeQuotaTotal · subscriptionStatus) **خارج موديل Prisma**
// عمدًا — كي لا يُجبَر أيّ findUnique/findMany بلا select على SELECTها فيكسر على قاعدةٍ
// لم تُطبَّق عليها الهجرة. القراءة/الكتابة عبر SQL خام داخل try/catch:
//   • التطوير: سقوط مفتوح (allowed=true) إن غابت الأعمدة — لا يتعطّل المطور.
//   • الإنتاج: سقوط مغلق (allowed=false) — لا استخدام بلا حد عند فشل الهجرة.
//
// القاعدة: الخصم مرّة واحدة بعد نجاح العملية فقط (consumeOne)، بزيادةٍ ذرّية تمنع التسابق
// مع شرط freeQuotaUsed < freeQuotaTotal.
// ─────────────────────────────────────────────────────────────────────────────
import { PRICING } from "@/config/pricing";

export interface QuotaRow {
  subscriptionStatus: string | null;
  freeQuotaUsed: number | null;
  freeQuotaTotal: number | null;
}
export interface QuotaDecision {
  allowed: boolean;
  remaining: number; // -1 = غير محدود (مشترك) أو غير معروف (قبل الهجرة في التطوير)
  isSubscribed: boolean;
  reason?: "exhausted" | "quota_unavailable";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
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

function openFailDecision(): QuotaDecision {
  if (isProduction()) {
    return {
      allowed: false,
      remaining: 0,
      isSubscribed: false,
      reason: "quota_unavailable",
    };
  }
  return { allowed: true, remaining: -1, isSubscribed: false };
}

/** هل يجوز الاستهلاك؟ في الإنتاج يُرفض عند غياب الأعمدة/الخطأ. */
export async function canConsume(userId: string): Promise<QuotaDecision> {
  try {
    const row = await readRow(userId);
    if (!row) return openFailDecision();
    return evaluateQuota(row);
  } catch {
    return openFailDecision();
  }
}

/** خصمٌ ذرّيّ لاستخدامٍ واحد (بعد النجاح). لا يخصم للمشتركين. لا يتجاوز الحد. */
export async function consumeOne(userId: string): Promise<{ remaining: number }> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const totalExpr = `COALESCE("freeQuotaTotal", ${PRICING.freeQuota})`;
    const rows = await prisma.$queryRawUnsafe<{ freeQuotaUsed: number; freeQuotaTotal: number | null }[]>(
      `UPDATE "users"
         SET "freeQuotaUsed" = "freeQuotaUsed" + 1
       WHERE id = $1
         AND COALESCE("subscriptionStatus", 'free') <> 'active'
         AND "freeQuotaUsed" < ${totalExpr}
       RETURNING "freeQuotaUsed", "freeQuotaTotal"`,
      userId
    );
    if (!rows[0]) return { remaining: -1 }; // مشترك أو نفاد أو لا صفّ
    const total = rows[0].freeQuotaTotal ?? PRICING.freeQuota;
    return { remaining: Math.max(0, total - rows[0].freeQuotaUsed) };
  } catch {
    return { remaining: isProduction() ? 0 : -1 };
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
    if (!row) {
      return {
        total: PRICING.freeQuota,
        used: 0,
        remaining: PRICING.freeQuota,
        isSubscribed: false,
        unknown: true,
      };
    }
    const isSubscribed = row.subscriptionStatus === "active";
    const total = row.freeQuotaTotal ?? PRICING.freeQuota;
    const used = row.freeQuotaUsed ?? 0;
    return { total, used, remaining: Math.max(0, total - used), isSubscribed };
  } catch {
    return {
      total: PRICING.freeQuota,
      used: 0,
      remaining: isProduction() ? 0 : PRICING.freeQuota,
      isSubscribed: false,
      unknown: true,
    };
  }
}
