/**
 * تقرير استهلاك جميع المستخدمين — حصّة مجانية + نقاط + حالة الاشتراك.
 * قراءة SQL خام مع سقوط آمن إن لم تُطبَّق هجرة الأعمدة.
 */
import { PRICING } from "@/config/pricing";
import { prisma } from "@/lib/prisma";

export type UsageUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  isActive: boolean;
  createdAt: string;
  subscriptionStatus: string;
  freeQuotaUsed: number;
  freeQuotaTotal: number;
  creditsBalance: number;
  exhausted: boolean;
};

export type UsageReportSummary = {
  usersTotal: number;
  activeUsers: number;
  subscribedActive: number;
  freeUsers: number;
  quotaExhausted: number;
  totalQuotaUsed: number;
  totalCreditsBalance: number;
  freeQuotaDefault: number;
  /** هل أعمدة الحصّة متاحة في القاعدة */
  quotaColumnsReady: boolean;
};

export type UsageReport = {
  summary: UsageReportSummary;
  users: UsageUserRow[];
  generatedAt: string;
};

const EMPTY_SUMMARY = (): UsageReportSummary => ({
  usersTotal: 0,
  activeUsers: 0,
  subscribedActive: 0,
  freeUsers: 0,
  quotaExhausted: 0,
  totalQuotaUsed: 0,
  totalCreditsBalance: 0,
  freeQuotaDefault: PRICING.freeQuota,
  quotaColumnsReady: false,
});

export type UsageReportFilter = {
  /** all | free | active | exhausted */
  status?: string;
  q?: string;
  limit?: number;
};

function normalizeFilter(input?: UsageReportFilter) {
  const status = (input?.status || "all").trim().toLowerCase();
  const q = (input?.q || "").trim().slice(0, 120);
  const limitRaw = input?.limit ?? 500;
  const limit = Math.min(2000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 500));
  return { status, q, limit };
}

export async function getUsageReport(filter?: UsageReportFilter): Promise<UsageReport> {
  const { status, q, limit } = normalizeFilter(filter);
  const generatedAt = new Date().toISOString();
  const summary = EMPTY_SUMMARY();

  try {
    summary.usersTotal = await prisma.user.count();
    summary.activeUsers = await prisma.user.count({ where: { isActive: true } });
  } catch {
    return { summary, users: [], generatedAt };
  }

  try {
    const agg = (await prisma.$queryRawUnsafe(
      `SELECT
         COUNT(*) FILTER (WHERE COALESCE("subscriptionStatus",'free') = 'active')::int AS subscribed,
         COUNT(*) FILTER (WHERE COALESCE("subscriptionStatus",'free') <> 'active')::int AS freeish,
         COUNT(*) FILTER (
           WHERE COALESCE("subscriptionStatus",'free') <> 'active'
             AND COALESCE("freeQuotaUsed",0) >= COALESCE("freeQuotaTotal", $1)
         )::int AS exhausted,
         COALESCE(SUM(COALESCE("freeQuotaUsed",0)),0)::int AS used_sum,
         COALESCE(SUM(COALESCE("creditsBalance",0)),0)::int AS credits_sum
       FROM "users"`,
      PRICING.freeQuota
    )) as Array<{
      subscribed: number;
      freeish: number;
      exhausted: number;
      used_sum: number;
      credits_sum: number;
    }>;
    if (agg[0]) {
      summary.subscribedActive = agg[0].subscribed;
      summary.freeUsers = agg[0].freeish;
      summary.quotaExhausted = agg[0].exhausted;
      summary.totalQuotaUsed = agg[0].used_sum;
      summary.totalCreditsBalance = agg[0].credits_sum;
      summary.quotaColumnsReady = true;
    }
  } catch {
    summary.quotaColumnsReady = false;
  }

  let users: UsageUserRow[] = [];
  try {
    const params: unknown[] = [PRICING.freeQuota];
    const where: string[] = [];

    if (status === "active") {
      where.push(`COALESCE(u."subscriptionStatus",'free') = 'active'`);
    } else if (status === "free") {
      where.push(`COALESCE(u."subscriptionStatus",'free') <> 'active'`);
    } else if (status === "exhausted") {
      where.push(`COALESCE(u."subscriptionStatus",'free') <> 'active'`);
      where.push(
        `COALESCE(u."freeQuotaUsed",0) >= COALESCE(u."freeQuotaTotal", $1)`
      );
    }

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(u.email ILIKE $${i} OR u.name ILIKE $${i})`);
    }

    params.push(limit);
    const limitParam = `$${params.length}`;
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = (await prisma.$queryRawUnsafe(
      `SELECT u.id, u.name, u.email, u.role::text AS role, u."isActive",
              u."createdAt",
              COALESCE(u."subscriptionStatus",'free') AS "subscriptionStatus",
              COALESCE(u."freeQuotaUsed",0)::int AS "freeQuotaUsed",
              COALESCE(u."freeQuotaTotal", $1)::int AS "freeQuotaTotal",
              COALESCE(u."creditsBalance",0)::int AS "creditsBalance"
         FROM "users" u
         ${whereSql}
        ORDER BY COALESCE(u."freeQuotaUsed",0) DESC, u."createdAt" DESC
        LIMIT ${limitParam}`,
      ...params
    )) as Array<{
      id: string;
      name: string | null;
      email: string | null;
      role: string | null;
      isActive: boolean;
      createdAt: Date;
      subscriptionStatus: string;
      freeQuotaUsed: number;
      freeQuotaTotal: number;
      creditsBalance: number;
    }>;

    users = rows.map((r) => {
      const total = r.freeQuotaTotal ?? PRICING.freeQuota;
      const used = r.freeQuotaUsed ?? 0;
      const sub = r.subscriptionStatus || "free";
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        isActive: Boolean(r.isActive),
        createdAt: new Date(r.createdAt).toISOString(),
        subscriptionStatus: sub,
        freeQuotaUsed: used,
        freeQuotaTotal: total,
        creditsBalance: r.creditsBalance ?? 0,
        exhausted: sub !== "active" && used >= total,
      };
    });
    if (!summary.quotaColumnsReady && users.length > 0) {
      summary.quotaColumnsReady = true;
    }
  } catch {
    // أعمدة الحصّة غير موجودة — أظهر المستخدمين بلا استهلاك
    try {
      const basic = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      });
      users = basic.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        subscriptionStatus: "free",
        freeQuotaUsed: 0,
        freeQuotaTotal: PRICING.freeQuota,
        creditsBalance: 0,
        exhausted: false,
      }));
    } catch {
      users = [];
    }
  }

  return { summary, users, generatedAt };
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** CSV بترميز UTF-8 مع BOM لتوافق Excel. */
export function usageReportToCsv(report: UsageReport): string {
  const header = [
    "id",
    "name",
    "email",
    "role",
    "isActive",
    "subscriptionStatus",
    "freeQuotaUsed",
    "freeQuotaTotal",
    "creditsBalance",
    "exhausted",
    "createdAt",
  ];
  const lines = [header.join(",")];
  for (const u of report.users) {
    lines.push(
      [
        csvEscape(u.id),
        csvEscape(u.name),
        csvEscape(u.email),
        csvEscape(u.role),
        csvEscape(u.isActive),
        csvEscape(u.subscriptionStatus),
        csvEscape(u.freeQuotaUsed),
        csvEscape(u.freeQuotaTotal),
        csvEscape(u.creditsBalance),
        csvEscape(u.exhausted),
        csvEscape(u.createdAt),
      ].join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}
