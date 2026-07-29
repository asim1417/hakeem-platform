/**
 * لقطة استهلاك لقائمة المستخدمين — حصّة + خدمات منفّذة + Claude.
 */
import { PRICING } from "@/config/pricing";
import { prisma } from "@/lib/prisma";
import {
  getClaudeAuditProxies,
  getClaudeUsageAggregates,
} from "@/lib/modules/billing/ai-usage-meter";

export type UserUsageSnapshot = {
  freeQuotaUsed: number;
  freeQuotaTotal: number;
  creditsBalance: number;
  subscriptionStatus: string;
  exhausted: boolean;
  consultations: number;
  simulations: number;
  askConversations: number;
  legalChatConversations: number;
  jaConversations: number;
  /** نداءات Claude (فعلي من العداد أو وكيل من التدقيق) */
  claudeCalls: number;
  /** رموز Anthropic الفعلية المسجّلة */
  claudeInputTokens: number;
  claudeOutputTokens: number;
  /** تقدير رموز من audit (للتاريخ قبل العداد) */
  claudeTokenEstimate: number;
  /** هل الأرقام الفعلية متوفرة من ai_usage_events */
  claudeMetered: boolean;
};

const EMPTY: UserUsageSnapshot = {
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
};

async function countByUser(sql: string, userIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!userIds.length) return map;
  try {
    const rows = (await prisma.$queryRawUnsafe(sql, userIds)) as Array<{
      uid: string;
      c: number;
    }>;
    for (const r of rows) map.set(r.uid, Number(r.c) || 0);
  } catch {
    /* */
  }
  return map;
}

async function enrichServiceAndClaude(
  userIds: string[],
  map: Map<string, UserUsageSnapshot>
): Promise<void> {
  if (!userIds.length) return;

  const [
    consultations,
    simulations,
    ask,
    legalChat,
    ja,
    claudeAgg,
    claudeProxy,
  ] = await Promise.all([
    countByUser(
      `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "consultations"
        WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`,
      userIds
    ),
    countByUser(
      `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "simulation_sessions"
        WHERE "userId" = ANY($1::text[]) GROUP BY "userId"`,
      userIds
    ),
    countByUser(
      `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
        WHERE user_id = ANY($1::text[])
          AND service_key = 'ask'
          AND deleted_at IS NULL
        GROUP BY user_id`,
      userIds
    ).then(async (primary) => {
      if (primary.size > 0) return primary;
      return countByUser(
        `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
          WHERE user_id = ANY($1::text[]) AND service_key = 'ask'
          GROUP BY user_id`,
        userIds
      );
    }),
    countByUser(
      `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
        WHERE user_id = ANY($1::text[])
          AND service_key = 'legal-chat'
          AND deleted_at IS NULL
        GROUP BY user_id`,
      userIds
    ).then(async (primary) => {
      if (primary.size > 0) return primary;
      return countByUser(
        `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
          WHERE user_id = ANY($1::text[]) AND service_key = 'legal-chat'
          GROUP BY user_id`,
        userIds
      );
    }),
    countByUser(
      `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
        WHERE user_id = ANY($1::text[])
          AND service_key = 'judicial-assistant'
          AND deleted_at IS NULL
        GROUP BY user_id`,
      userIds
    ).then(async (primary) => {
      if (primary.size > 0) return primary;
      return countByUser(
        `SELECT user_id AS uid, COUNT(*)::int AS c FROM "chat_conversations"
          WHERE user_id = ANY($1::text[]) AND service_key = 'judicial-assistant'
          GROUP BY user_id`,
        userIds
      );
    }),
    getClaudeUsageAggregates(userIds),
    getClaudeAuditProxies(userIds),
  ]);

  for (const id of userIds) {
    const snap = map.get(id) ?? { ...EMPTY };
    snap.consultations = consultations.get(id) ?? 0;
    snap.simulations = simulations.get(id) ?? 0;
    snap.askConversations = ask.get(id) ?? 0;
    snap.legalChatConversations = legalChat.get(id) ?? 0;
    snap.jaConversations = ja.get(id) ?? 0;

    const metered = claudeAgg.get(id);
    const proxy = claudeProxy.get(id);
    if (metered && metered.calls > 0) {
      snap.claudeMetered = true;
      snap.claudeCalls = metered.calls;
      snap.claudeInputTokens = metered.inputTokens;
      snap.claudeOutputTokens = metered.outputTokens;
      snap.claudeTokenEstimate = proxy?.tokenEstimate ?? 0;
    } else {
      snap.claudeMetered = false;
      snap.claudeCalls = proxy?.calls ?? 0;
      snap.claudeInputTokens = 0;
      snap.claudeOutputTokens = 0;
      snap.claudeTokenEstimate = proxy?.tokenEstimate ?? 0;
    }
    map.set(id, snap);
  }
}

/** يقرأ أعمدة الحصّة/النقاط + الخدمات + Claude لمجموعة مستخدمين. سقوط آمن إن غابت الأعمدة. */
export async function getUsersUsageSnapshots(
  userIds: string[]
): Promise<Map<string, UserUsageSnapshot>> {
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
      map.set(r.id, {
        ...EMPTY,
        freeQuotaUsed: used,
        freeQuotaTotal: total,
        creditsBalance: r.creditsBalance ?? 0,
        subscriptionStatus: sub,
        exhausted: sub !== "active" && used >= total,
      });
    }
  } catch {
    for (const id of userIds) map.set(id, { ...EMPTY });
  }

  for (const id of userIds) {
    if (!map.has(id)) map.set(id, { ...EMPTY });
  }

  await enrichServiceAndClaude(userIds, map);
  return map;
}
