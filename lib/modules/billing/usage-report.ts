/**
 * تقرير استهلاك جميع المستخدمين — حصّة + نقاط + نشاط فعلي (استشارات/محاكاة/محادثات/AI).
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
  creditsSpent: number;
  exhausted: boolean;
  consultations: number;
  simulations: number;
  askConversations: number;
  aiEvents: number;
  /** مجموع مؤشرات النشاط الفعلي */
  activityScore: number;
  lastActiveAt: string | null;
};

export type UsageReportSummary = {
  usersTotal: number;
  activeUsers: number;
  subscribedActive: number;
  freeUsers: number;
  quotaExhausted: number;
  totalQuotaUsed: number;
  totalCreditsBalance: number;
  totalCreditsSpent: number;
  totalConsultations: number;
  totalSimulations: number;
  totalAskConversations: number;
  totalAiEvents: number;
  usersWithActivity: number;
  freeQuotaDefault: number;
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
  totalCreditsSpent: 0,
  totalConsultations: 0,
  totalSimulations: 0,
  totalAskConversations: 0,
  totalAiEvents: 0,
  usersWithActivity: 0,
  freeQuotaDefault: PRICING.freeQuota,
  quotaColumnsReady: false,
});

export type UsageReportFilter = {
  /** all | free | active | exhausted | active_users */
  status?: string;
  q?: string;
  limit?: number;
  /** ترتيب: quota | activity | credits | recent */
  sort?: string;
};

function normalizeFilter(input?: UsageReportFilter) {
  const status = (input?.status || "all").trim().toLowerCase();
  const q = (input?.q || "").trim().slice(0, 120);
  const sort = (input?.sort || "activity").trim().toLowerCase();
  const limitRaw = input?.limit ?? 500;
  const limit = Math.min(2000, Math.max(1, Number.isFinite(limitRaw) ? Number(limitRaw) : 500));
  return { status, q, sort, limit };
}

async function countMap(
  sql: string,
  ids: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!ids.length) return map;
  try {
    const rows = (await prisma.$queryRawUnsafe(sql, ids)) as Array<{
      uid: string;
      c: number;
    }>;
    for (const r of rows) map.set(r.uid, Number(r.c) || 0);
  } catch {
    /* جدول غير موجود */
  }
  return map;
}

async function dateMap(
  sql: string,
  ids: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!ids.length) return map;
  try {
    const rows = (await prisma.$queryRawUnsafe(sql, ids)) as Array<{
      uid: string;
      ts: Date | string | null;
    }>;
    for (const r of rows) {
      if (!r.ts) continue;
      map.set(r.uid, new Date(r.ts).toISOString());
    }
  } catch {
    /* */
  }
  return map;
}

async function loadPlatformActivityTotals(summary: UsageReportSummary) {
  try {
    summary.totalConsultations = await prisma.consultation.count();
  } catch {
    /* */
  }
  try {
    summary.totalSimulations = await prisma.simulation.count();
  } catch {
    /* */
  }
  try {
    summary.totalAskConversations = await prisma.chatConversation.count({
      where: { serviceKey: "ask", deletedAt: null },
    });
  } catch {
    try {
      summary.totalAskConversations = await prisma.chatConversation.count({
        where: { serviceKey: "ask" },
      });
    } catch {
      /* */
    }
  }
  try {
    summary.totalAiEvents = await prisma.auditEvent.count({
      where: {
        OR: [
          { subject: "AI_GATEWAY" },
          { action: { startsWith: "JA_ASK" } },
          { action: "LEGAL_CHAT_TURN" },
        ],
      },
    });
  } catch {
    /* */
  }
  try {
    const spent = (await prisma.$queryRawUnsafe(
      `SELECT COALESCE(SUM(ABS(amount)),0)::int AS s
         FROM "credit_transactions"
        WHERE amount < 0 AND status = 'active'`
    )) as Array<{ s: number }>;
    summary.totalCreditsSpent = spent[0]?.s ?? 0;
  } catch {
    /* */
  }
}

async function enrichUsers(users: UsageUserRow[]): Promise<void> {
  const ids = users.map((u) => u.id);
  if (!ids.length) return;

  const asksPrimary = await countMap(
    `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
      WHERE user_id = ANY($1::text[])
        AND service_key = 'ask'
        AND deleted_at IS NULL
      GROUP BY user_id`,
    ids
  );
  const asksFallback =
    asksPrimary.size > 0
      ? asksPrimary
      : await countMap(
          `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
            WHERE user_id = ANY($1::text[]) AND service_key = 'ask'
            GROUP BY user_id`,
          ids
        );

  const [consultations, simulations, aiEvents, creditsSpent, lastAudit, lastCredit] =
    await Promise.all([
      countMap(
        `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "consultations"
          WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`,
        ids
      ),
      countMap(
        `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "simulation_sessions"
          WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`,
        ids
      ),
      countMap(
        `SELECT "actorId" AS uid, COUNT(*)::int AS c FROM "audit_logs"
          WHERE "actorId" = ANY($1::text[])
            AND (
              subject::text = 'AI_GATEWAY'
              OR action LIKE 'JA_ASK%'
              OR action = 'LEGAL_CHAT_TURN'
            )
          GROUP BY "actorId"`,
        ids
      ),
      countMap(
        `SELECT "userId" AS uid, COALESCE(SUM(ABS(amount)),0)::int AS c
           FROM "credit_transactions"
          WHERE "userId" = ANY($1::text[]) AND amount < 0 AND status = 'active'
          GROUP BY "userId"`,
        ids
      ),
      dateMap(
        `SELECT "actorId" AS uid, MAX("createdAt") AS ts FROM "audit_logs"
          WHERE "actorId" = ANY($1::text[]) GROUP BY "actorId"`,
        ids
      ),
      dateMap(
        `SELECT "userId" AS uid, MAX("createdAt") AS ts FROM "credit_transactions"
          WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`,
        ids
      ),
    ]);

  const asks = asksFallback;

  for (const u of users) {
    u.consultations = consultations.get(u.id) ?? 0;
    u.simulations = simulations.get(u.id) ?? 0;
    u.askConversations = asks.get(u.id) ?? 0;
    u.aiEvents = aiEvents.get(u.id) ?? 0;
    u.creditsSpent = creditsSpent.get(u.id) ?? 0;
    u.activityScore =
      u.freeQuotaUsed +
      u.consultations +
      u.simulations +
      u.askConversations +
      u.aiEvents;
    const a = lastAudit.get(u.id);
    const c = lastCredit.get(u.id);
    if (a && c) u.lastActiveAt = a > c ? a : c;
    else u.lastActiveAt = a || c || null;
  }
}

export async function getUsageReport(filter?: UsageReportFilter): Promise<UsageReport> {
  const { status, q, sort, limit } = normalizeFilter(filter);
  const generatedAt = new Date().toISOString();
  const summary = EMPTY_SUMMARY();

  try {
    summary.usersTotal = await prisma.user.count();
    summary.activeUsers = await prisma.user.count({ where: { isActive: true } });
  } catch {
    return { summary, users: [], generatedAt };
  }

  await loadPlatformActivityTotals(summary);

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
      where.push(`COALESCE(u."freeQuotaUsed",0) >= COALESCE(u."freeQuotaTotal", $1)`);
    }

    if (q) {
      params.push(`%${q}%`);
      const i = params.length;
      where.push(`(u.email ILIKE $${i} OR u.name ILIKE $${i})`);
    }

    // نجلب أكثر قليلًا إن رُشِّح «نشطون فعليًا» ثم نصفي بعد الإثراء
    const fetchLimit = status === "active_users" ? Math.min(2000, limit * 3) : limit;
    params.push(fetchLimit);
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
        creditsSpent: 0,
        exhausted: sub !== "active" && used >= total,
        consultations: 0,
        simulations: 0,
        askConversations: 0,
        aiEvents: 0,
        activityScore: used,
        lastActiveAt: null,
      };
    });
    if (!summary.quotaColumnsReady && users.length > 0) {
      summary.quotaColumnsReady = true;
    }
  } catch {
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
        creditsSpent: 0,
        exhausted: false,
        consultations: 0,
        simulations: 0,
        askConversations: 0,
        aiEvents: 0,
        activityScore: 0,
        lastActiveAt: null,
      }));
    } catch {
      users = [];
    }
  }

  await enrichUsers(users);

  if (status === "active_users") {
    users = users.filter((u) => u.activityScore > 0).slice(0, limit);
  }

  summary.usersWithActivity = users.filter((u) => u.activityScore > 0).length;

  users.sort((a, b) => {
    if (sort === "quota") return b.freeQuotaUsed - a.freeQuotaUsed || b.activityScore - a.activityScore;
    if (sort === "credits") return b.creditsSpent - a.creditsSpent || b.creditsBalance - a.creditsBalance;
    if (sort === "recent") {
      const at = a.lastActiveAt || a.createdAt;
      const bt = b.lastActiveAt || b.createdAt;
      return bt.localeCompare(at);
    }
    return b.activityScore - a.activityScore || b.freeQuotaUsed - a.freeQuotaUsed;
  });

  return { summary, users, generatedAt };
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

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
    "creditsSpent",
    "consultations",
    "simulations",
    "askConversations",
    "aiEvents",
    "activityScore",
    "lastActiveAt",
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
        csvEscape(u.creditsSpent),
        csvEscape(u.consultations),
        csvEscape(u.simulations),
        csvEscape(u.askConversations),
        csvEscape(u.aiEvents),
        csvEscape(u.activityScore),
        csvEscape(u.lastActiveAt),
        csvEscape(u.exhausted),
        csvEscape(u.createdAt),
      ].join(",")
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}
