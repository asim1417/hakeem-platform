// ─────────────────────────────────────────────────────────────────────────────
// حوافز الارتباط: زيارة دورية / قراءة مادة / حفظ حكم.
// ─────────────────────────────────────────────────────────────────────────────
import { CREDIT_REWARDS } from "@/config/credits";
import { awardCredits } from "@/lib/modules/credits/ledger";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** كل 3 أيام: +25 — مصدر فريد بالتاريخ. */
export async function awardDailyVisit(userId: string): Promise<number> {
  const day = todayKey();
  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.$queryRawUnsafe<{ lastDailyVisit: string | Date | null }[]>(
      `SELECT "lastDailyVisit" FROM "users" WHERE id = $1 LIMIT 1`,
      userId
    );
    const last = rows[0]?.lastDailyVisit
      ? new Date(rows[0].lastDailyVisit).getTime()
      : 0;
    const elapsedDays = last ? (Date.now() - last) / (24 * 60 * 60 * 1000) : 999;
    if (elapsedDays < 3) return 0;

    const result = await awardCredits(userId, `daily_visit_${day}`, CREDIT_REWARDS.daily_visit);
    if (result.awarded > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "users" SET "lastDailyVisit" = $2::date WHERE id = $1`,
        userId,
        day
      );
    }
    return result.awarded;
  } catch {
    // بلا عمود lastDailyVisit: ما زال يمكن منح مصدر يومي
    const result = await awardCredits(userId, `daily_visit_${day}`, CREDIT_REWARDS.daily_visit);
    return result.awarded;
  }
}

export async function awardReadArticle(userId: string, articleId: string): Promise<number> {
  if (!articleId) return 0;
  const r = await awardCredits(userId, `read_article_${articleId}`, CREDIT_REWARDS.read_article);
  return r.awarded;
}

export async function awardSaveRuling(userId: string, rulingId: string): Promise<number> {
  if (!rulingId) return 0;
  const r = await awardCredits(userId, `save_ruling_${rulingId}`, CREDIT_REWARDS.save_ruling);
  return r.awarded;
}
