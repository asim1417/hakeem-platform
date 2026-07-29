/**
 * لقطة استهلاك لقائمة المستخدمين — حصّة حالية + نشاط الأسبوع الماضي كامل.
 */
import { PRICING } from "@/config/pricing";
import { prisma } from "@/lib/prisma";
import {
  getClaudeAuditProxies,
  getClaudeUsageAggregates,
} from "@/lib/modules/billing/ai-usage-meter";

export type WeekServiceCounts = {
  consultations: number;
  simulations: number;
  askConversations: number;
  legalChatConversations: number;
  jaConversations: number;
};

export type UserWeekUsage = WeekServiceCounts & {
  /** بداية نافذة الأسبوع (ISO) */
  from: string;
  /** نهاية النافذة (ISO) */
  to: string;
  /** نقاط مخصومة خلال الأسبوع */
  creditsSpent: number;
  /** أسماء الخدمات التي زارها/استخدمها هذا الأسبوع */
  servicesVisited: string[];
  claudeCalls: number;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  claudeTokenEstimate: number;
  claudeMetered: boolean;
};

export type UserUsageSnapshot = {
  freeQuotaUsed: number;
  freeQuotaTotal: number;
  creditsBalance: number;
  subscriptionStatus: string;
  exhausted: boolean;
  /** إجمالي مدى الحياة (مرجع) */
  consultations: number;
  simulations: number;
  askConversations: number;
  legalChatConversations: number;
  jaConversations: number;
  claudeCalls: number;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  claudeTokenEstimate: number;
  claudeMetered: boolean;
  /** نشاط آخر 7 أيام — العرض الرئيسي في اللوحة */
  week: UserWeekUsage;
};

const SERVICE_LABELS: Array<{ key: keyof WeekServiceCounts; label: string }> = [
  { key: "consultations", label: "استشارات" },
  { key: "simulations", label: "محاكاة" },
  { key: "askConversations", label: "اسأل حكيم" },
  { key: "legalChatConversations", label: "محادثة قانونية" },
  { key: "jaConversations", label: "معاون قضائي" },
];

export function pastWeekWindow(now = new Date()): { from: Date; to: Date } {
  const to = new Date(now);
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from, to };
}

function emptyWeek(from: Date, to: Date): UserWeekUsage {
  return {
    from: from.toISOString(),
    to: to.toISOString(),
    creditsSpent: 0,
    consultations: 0,
    simulations: 0,
    askConversations: 0,
    legalChatConversations: 0,
    jaConversations: 0,
    servicesVisited: [],
    claudeCalls: 0,
    claudeInputTokens: 0,
    claudeOutputTokens: 0,
    claudeTokenEstimate: 0,
    claudeMetered: false,
  };
}

function emptySnapshot(from: Date, to: Date): UserUsageSnapshot {
  return {
    freeQuotaUsed: 0,
    freeQuotaTotal: PRICING.freeQuota,
    creditsBalance: 0,
    subscriptionStatus: "free",
    exhausted: false,
    consultations: 0,
    simulations: 0,
    askConversations: 0,
    legalChatConversations: 0,
    jaConversations: 0,
    claudeCalls: 0,
    claudeInputTokens: 0,
    claudeOutputTokens: 0,
    claudeTokenEstimate: 0,
    claudeMetered: false,
    week: emptyWeek(from, to),
  };
}

function visitedFromCounts(c: WeekServiceCounts): string[] {
  return SERVICE_LABELS.filter((s) => (c[s.key] ?? 0) > 0).map((s) => s.label);
}

async function countByUser(
  sql: string,
  params: unknown[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!params.length || !(params[0] as string[])?.length) return map;
  try {
    const rows = (await prisma.$queryRawUnsafe(sql, ...params)) as Array<{
      uid: string;
      c: number;
    }>;
    for (const r of rows) map.set(r.uid, Number(r.c) || 0);
  } catch {
    /* */
  }
  return map;
}

async function chatCount(
  userIds: string[],
  serviceKey: string,
  since?: Date
): Promise<Map<string, number>> {
  if (since) {
    const primary = await countByUser(
      `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
        WHERE user_id = ANY($1::text[])
          AND service_key = $2
          AND deleted_at IS NULL
          AND updated_at >= $3::timestamptz
        GROUP BY user_id`,
      [userIds, serviceKey, since]
    );
    if (primary.size > 0) return primary;
    return countByUser(
      `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
        WHERE user_id = ANY($1::text[])
          AND service_key = $2
          AND updated_at >= $3::timestamptz
        GROUP BY user_id`,
      [userIds, serviceKey, since]
    );
  }
  const primary = await countByUser(
    `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
      WHERE user_id = ANY($1::text[])
        AND service_key = $2
        AND deleted_at IS NULL
      GROUP BY user_id`,
    [userIds, serviceKey]
  );
  if (primary.size > 0) return primary;
  return countByUser(
    `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
      WHERE user_id = ANY($1::text[]) AND service_key = $2
      GROUP BY user_id`,
    [userIds, serviceKey]
  );
}

async function loadServiceCounts(
  userIds: string[],
  since?: Date
): Promise<Map<string, WeekServiceCounts>> {
  const out = new Map<string, WeekServiceCounts>();
  for (const id of userIds) {
    out.set(id, {
      consultations: 0,
      simulations: 0,
      askConversations: 0,
      legalChatConversations: 0,
      jaConversations: 0,
    });
  }
  if (!userIds.length) return out;

  const consultSql = since
    ? `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "consultations"
        WHERE "userId" = ANY($1::text[]) AND "createdAt" >= $2::timestamptz
        GROUP BY "userId"`
    : `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "consultations"
        WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`;
  const simSql = since
    ? `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "simulation_sessions"
        WHERE "userId" = ANY($1::text[]) AND "createdAt" >= $2::timestamptz
        GROUP BY "userId"`
    : `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "simulation_sessions"
        WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`;

  const [consultations, simulations, ask, legalChat, ja] = await Promise.all([
    countByUser(consultSql, since ? [userIds, since] : [userIds]),
    countByUser(simSql, since ? [userIds, since] : [userIds]),
    chatCount(userIds, "ask", since),
    chatCount(userIds, "legal-chat", since),
    chatCount(userIds, "judicial-assistant", since),
  ]);

  for (const id of userIds) {
    out.set(id, {
      consultations: consultations.get(id) ?? 0,
      simulations: simulations.get(id) ?? 0,
      askConversations: ask.get(id) ?? 0,
      legalChatConversations: legalChat.get(id) ?? 0,
      jaConversations: ja.get(id) ?? 0,
    });
  }
  return out;
}

async function creditsSpentMap(
  userIds: string[],
  since: Date
): Promise<Map<string, number>> {
  return countByUser(
    `SELECT "userId" AS uid, COALESCE(SUM(ABS(amount)),0)::int AS c
       FROM "credit_transactions"
      WHERE "userId" = ANY($1::text[])
        AND amount < 0
        AND status = 'active'
        AND "createdAt" >= $2::timestamptz
      GROUP BY "userId"`,
    [userIds, since]
  );
}

function applyClaude(
  target: {
    claudeCalls: number;
    claudeInputTokens: number;
    claudeOutputTokens: number;
    claudeTokenEstimate: number;
    claudeMetered: boolean;
  },
  metered: { calls: number; inputTokens: number; outputTokens: number } | undefined,
  proxy: { calls: number; tokenEstimate: number } | undefined
) {
  if (metered && metered.calls > 0) {
    target.claudeMetered = true;
    target.claudeCalls = metered.calls;
    target.claudeInputTokens = metered.inputTokens;
    target.claudeOutputTokens = metered.outputTokens;
    target.claudeTokenEstimate = proxy?.tokenEstimate ?? 0;
  } else {
    target.claudeMetered = false;
    target.claudeCalls = proxy?.calls ?? 0;
    target.claudeInputTokens = 0;
    target.claudeOutputTokens = 0;
    target.claudeTokenEstimate = proxy?.tokenEstimate ?? 0;
  }
}

/** يقرأ الحصّة الحالية + نشاط الأسبوع الماضي (خدمات، رصيد مخصوم، Claude). */
export async function getUsersUsageSnapshots(
  userIds: string[]
): Promise<Map<string, UserUsageSnapshot>> {
  const { from, to } = pastWeekWindow();
  const map = new Map<string, UserUsageSnapshot>();
  if (!userIds.length) return map;

  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id,
              COALESCE("subscriptionStatus",'free') AS "subscriptionStatus",
              COALESCE("freeQuotaUsed",0)::int AS "freeQuotaUsed",
              COALESCE("freeQuotaTotal", $2)::int AS "freeQuotaTotal",
              COALESCE("creditsBalance",0)::int AS "creditsBalance"
         FROM "users"
        WHERE id = ANY($1::text[])`,
      userIds,
      PRICING.freeQuota
    )) as Array<{
      id: string;
      subscriptionStatus: string;
      freeQuotaUsed: number;
      freeQuotaTotal: number;
      creditsBalance: number;
    }>;

    for (const r of rows) {
      const total = r.freeQuotaTotal ?? PRICING.freeQuota;
      const used = r.freeQuotaUsed ?? 0;
      const sub = r.subscriptionStatus || "free";
      const snap = emptySnapshot(from, to);
      snap.freeQuotaUsed = used;
      snap.freeQuotaTotal = total;
      snap.creditsBalance = r.creditsBalance ?? 0;
      snap.subscriptionStatus = sub;
      snap.exhausted = sub !== "active" && used >= total;
      map.set(r.id, snap);
    }
  } catch {
    for (const id of userIds) map.set(id, emptySnapshot(from, to));
  }

  for (const id of userIds) {
    if (!map.has(id)) map.set(id, emptySnapshot(from, to));
  }

  const [lifetime, weekCounts, spent, claudeLife, proxyLife, claudeWeek, proxyWeek] =
    await Promise.all([
      loadServiceCounts(userIds),
      loadServiceCounts(userIds, from),
      creditsSpentMap(userIds, from),
      getClaudeUsageAggregates(userIds),
      getClaudeAuditProxies(userIds),
      getClaudeUsageAggregates(userIds, { since: from }),
      getClaudeAuditProxies(userIds, { since: from }),
    ]);

  for (const id of userIds) {
    const snap = map.get(id) ?? emptySnapshot(from, to);
    const life = lifetime.get(id) ?? {
      consultations: 0,
      simulations: 0,
      askConversations: 0,
      legalChatConversations: 0,
      jaConversations: 0,
    };
    snap.consultations = life.consultations;
    snap.simulations = life.simulations;
    snap.askConversations = life.askConversations;
    snap.legalChatConversations = life.legalChatConversations;
    snap.jaConversations = life.jaConversations;
    applyClaude(snap, claudeLife.get(id), proxyLife.get(id));

    const w = weekCounts.get(id) ?? {
      consultations: 0,
      simulations: 0,
      askConversations: 0,
      legalChatConversations: 0,
      jaConversations: 0,
    };
    snap.week = {
      from: from.toISOString(),
      to: to.toISOString(),
      creditsSpent: spent.get(id) ?? 0,
      consultations: w.consultations,
      simulations: w.simulations,
      askConversations: w.askConversations,
      legalChatConversations: w.legalChatConversations,
      jaConversations: w.jaConversations,
      servicesVisited: visitedFromCounts(w),
      claudeCalls: 0,
      claudeInputTokens: 0,
      claudeOutputTokens: 0,
      claudeTokenEstimate: 0,
      claudeMetered: false,
    };
    applyClaude(snap.week, claudeWeek.get(id), proxyWeek.get(id));
    map.set(id, snap);
  }

  return map;
}
