// ─────────────────────────────────────────────────────────────────────────────
// دفتر نقاط حكيم — SQL خام + سقوط مفتوح قبل الهجرة (مثل quota).
// كل مصدر يُمنح مرة واحدة فقط (idempotent عبر source لكل user).
// ─────────────────────────────────────────────────────────────────────────────
import { randomBytes } from "crypto";
import { CREDIT_REWARDS, type CreditSource } from "@/config/credits";

export interface CreditTx {
  id: string;
  amount: number;
  source: string;
  status: string;
  createdAt: Date;
}

export interface CreditsStatus {
  balance: number;
  transactions: CreditTx[];
  /** قبل الهجرة / خطأ — لا تُظهر الواجهة رصيدًا مضلّلًا */
  unknown?: boolean;
}

function newId(): string {
  return `ctx_${randomBytes(12).toString("hex")}`;
}

/** هل مُنح هذا المصدر سابقًا؟ */
export async function hasAwarded(userId: string, source: string): Promise<boolean> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "credit_transactions" WHERE "userId" = $1 AND source = $2 AND status = 'active' LIMIT 1`,
      userId,
      source
    );
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

/**
 * منح نقاط لمرة واحدة لكل (userId, source).
 * يعيد المبلغ الممنوح (0 إن سبق أو فشل/قبل الهجرة).
 */
export async function awardCredits(
  userId: string,
  source: CreditSource | string,
  amount?: number
): Promise<{ awarded: number; balance: number }> {
  const pts =
    amount ??
    (source in CREDIT_REWARDS ? CREDIT_REWARDS[source as CreditSource] : 0);
  if (!userId || pts <= 0) return { awarded: 0, balance: 0 };

  try {
    const { prisma } = await import("@/lib/prisma");
    if (await hasAwarded(userId, source)) {
      const bal = await getBalance(userId);
      return { awarded: 0, balance: bal };
    }

    const id = newId();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "credit_transactions" (id, "userId", amount, source, status)
       VALUES ($1, $2, $3, $4, 'active')`,
      id,
      userId,
      pts,
      source
    );
    const rows = await prisma.$queryRawUnsafe<{ creditsBalance: number }[]>(
      `UPDATE "users"
         SET "creditsBalance" = COALESCE("creditsBalance", 0) + $2
       WHERE id = $1
       RETURNING "creditsBalance"`,
      userId,
      pts
    );
    return { awarded: pts, balance: rows[0]?.creditsBalance ?? pts };
  } catch {
    return { awarded: 0, balance: 0 };
  }
}

export async function getBalance(userId: string): Promise<number> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ creditsBalance: number | null }[]>(
      `SELECT "creditsBalance" FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    return rows[0]?.creditsBalance ?? 0;
  } catch {
    return 0;
  }
}

export async function getCreditsStatus(userId: string, limit = 20): Promise<CreditsStatus> {
  try {
    const { prisma } = await import("@/lib/prisma");
    const balRows = await prisma.$queryRawUnsafe<{ creditsBalance: number | null }[]>(
      `SELECT "creditsBalance" FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    if (!balRows[0]) return { balance: 0, transactions: [], unknown: true };

    const txs = await prisma.$queryRawUnsafe<CreditTx[]>(
      `SELECT id, amount, source, status, "createdAt"
         FROM "credit_transactions"
        WHERE "userId" = $1 AND status = 'active'
        ORDER BY "createdAt" DESC
        LIMIT $2`,
      userId,
      limit
    );
    return { balance: balRows[0].creditsBalance ?? 0, transactions: txs };
  } catch {
    return { balance: 0, transactions: [], unknown: true };
  }
}

/** منح حزمة الترحيب + التسجيل (مرة واحدة لكل مستخدم جديد). */
export async function awardSignupBundle(userId: string): Promise<number> {
  const a = await awardCredits(userId, "welcome");
  const b = await awardCredits(userId, "signup");
  return a.awarded + b.awarded;
}
