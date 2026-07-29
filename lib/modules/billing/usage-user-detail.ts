/**
 * تفاصيل استهلاك مستخدم واحد — إحصاءات + خط زمني (تدقيق + نقاط).
 */
import { PRICING } from "@/config/pricing";
import { activityLabel } from "@/lib/activity-labels";
import { prisma } from "@/lib/prisma";
import {
  getClaudeAuditProxies,
  getClaudeUsageAggregates,
} from "@/lib/modules/billing/ai-usage-meter";

export type UsageUserDetail = {
  user: {
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
  stats: {
    consultations: number;
    simulations: number;
    askConversations: number;
    legalChatConversations: number;
    jaConversations: number;
    aiEvents: number;
    auditEvents: number;
    creditsSpent: number;
    creditsEarned: number;
    claudeCalls: number;
    claudeInputTokens: number;
    claudeOutputTokens: number;
    claudeTokenEstimate: number;
    claudeMetered: boolean;
  };
  recentConsultations: Array<{
    id: string;
    status: string;
    createdAt: string;
    preview: string;
  }>;
  recentSimulations: Array<{
    id: string;
    title: string;
    stage: string;
    createdAt: string;
  }>;
  recentConversations: Array<{
    id: string;
    title: string;
    serviceKey: string;
    updatedAt: string;
  }>;
  timeline: Array<{
    id: string;
    kind: "audit" | "credit";
    at: string;
    title: string;
    detail: string;
    amount?: number;
  }>;
};

function emptyDetail(userId: string): UsageUserDetail {
  return {
    user: {
      id: userId,
      name: null,
      email: null,
      role: null,
      isActive: false,
      createdAt: new Date(0).toISOString(),
      subscriptionStatus: "free",
      freeQuotaUsed: 0,
      freeQuotaTotal: PRICING.freeQuota,
      creditsBalance: 0,
      exhausted: false,
    },
    stats: {
      consultations: 0,
      simulations: 0,
      askConversations: 0,
      legalChatConversations: 0,
      jaConversations: 0,
      aiEvents: 0,
      auditEvents: 0,
      creditsSpent: 0,
      creditsEarned: 0,
      claudeCalls: 0,
      claudeInputTokens: 0,
      claudeOutputTokens: 0,
      claudeTokenEstimate: 0,
      claudeMetered: false,
    },
    recentConsultations: [],
    recentSimulations: [],
    recentConversations: [],
    timeline: [],
  };
}

export async function getUsageUserDetail(userId: string): Promise<UsageUserDetail | null> {
  const id = userId.trim();
  if (!id) return null;

  const out = emptyDetail(id);

  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT id, name, email, role::text AS role, "isActive", "createdAt",
              COALESCE("subscriptionStatus",'free') AS "subscriptionStatus",
              COALESCE("freeQuotaUsed",0)::int AS "freeQuotaUsed",
              COALESCE("freeQuotaTotal", $2)::int AS "freeQuotaTotal",
              COALESCE("creditsBalance",0)::int AS "creditsBalance"
         FROM "users" WHERE id = $1 LIMIT 1`,
      id,
      PRICING.freeQuota
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
    const r = rows[0];
    if (!r) {
      const basic = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });
      if (!basic) return null;
      out.user = {
        id: basic.id,
        name: basic.name,
        email: basic.email,
        role: basic.role,
        isActive: basic.isActive,
        createdAt: basic.createdAt.toISOString(),
        subscriptionStatus: "free",
        freeQuotaUsed: 0,
        freeQuotaTotal: PRICING.freeQuota,
        creditsBalance: 0,
        exhausted: false,
      };
    } else {
      const total = r.freeQuotaTotal ?? PRICING.freeQuota;
      const used = r.freeQuotaUsed ?? 0;
      const sub = r.subscriptionStatus || "free";
      out.user = {
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
    }
  } catch {
    return null;
  }

  try {
    out.stats.consultations = await prisma.consultation.count({ where: { userId: id } });
  } catch {
    /* */
  }
  try {
    out.stats.simulations = await prisma.simulation.count({ where: { userId: id } });
  } catch {
    /* */
  }
  try {
    const chats = await prisma.chatConversation.groupBy({
      by: ["serviceKey"],
      where: { userId: id, deletedAt: null },
      _count: { _all: true },
    });
    for (const row of chats) {
      const n = row._count._all;
      if (row.serviceKey === "ask") out.stats.askConversations = n;
      else if (row.serviceKey === "legal-chat") out.stats.legalChatConversations = n;
      else if (row.serviceKey === "judicial-assistant") out.stats.jaConversations = n;
    }
  } catch {
    try {
      out.stats.askConversations = await prisma.chatConversation.count({
        where: { userId: id, serviceKey: "ask" },
      });
    } catch {
      /* */
    }
  }
  try {
    out.stats.aiEvents = await prisma.auditEvent.count({
      where: {
        actorId: id,
        OR: [
          { subject: "AI_GATEWAY" },
          { action: { startsWith: "JA_ASK" } },
          { action: "LEGAL_CHAT_TURN" },
        ],
      },
    });
    out.stats.auditEvents = await prisma.auditEvent.count({ where: { actorId: id } });
  } catch {
    /* */
  }
  try {
    const spent = (await prisma.$queryRawUnsafe(
      `SELECT
         COALESCE(SUM(ABS(amount)) FILTER (WHERE amount < 0),0)::int AS spent,
         COALESCE(SUM(amount) FILTER (WHERE amount > 0),0)::int AS earned
         FROM "credit_transactions"
        WHERE "userId" = $1 AND status = 'active'`,
      id
    )) as Array<{ spent: number; earned: number }>;
    out.stats.creditsSpent = spent[0]?.spent ?? 0;
    out.stats.creditsEarned = spent[0]?.earned ?? 0;
  } catch {
    /* */
  }

  try {
    const [aggMap, proxyMap] = await Promise.all([
      getClaudeUsageAggregates([id]),
      getClaudeAuditProxies([id]),
    ]);
    const metered = aggMap.get(id);
    const proxy = proxyMap.get(id);
    if (metered && metered.calls > 0) {
      out.stats.claudeMetered = true;
      out.stats.claudeCalls = metered.calls;
      out.stats.claudeInputTokens = metered.inputTokens;
      out.stats.claudeOutputTokens = metered.outputTokens;
      out.stats.claudeTokenEstimate = proxy?.tokenEstimate ?? 0;
    } else {
      out.stats.claudeMetered = false;
      out.stats.claudeCalls = proxy?.calls ?? 0;
      out.stats.claudeTokenEstimate = proxy?.tokenEstimate ?? 0;
    }
  } catch {
    /* */
  }

  try {
    const list = await prisma.consultation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, status: true, facts: true, createdAt: true },
    });
    out.recentConsultations = list.map((c) => ({
      id: c.id,
      status: c.status,
      createdAt: c.createdAt.toISOString(),
      preview: (c.facts || "").slice(0, 120),
    }));
  } catch {
    /* */
  }

  try {
    const list = await prisma.simulation.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, stage: true, createdAt: true },
    });
    out.recentSimulations = list.map((s) => ({
      id: s.id,
      title: s.title,
      stage: String(s.stage),
      createdAt: s.createdAt.toISOString(),
    }));
  } catch {
    /* */
  }

  try {
    const list = await prisma.chatConversation.findMany({
      where: { userId: id, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { id: true, title: true, serviceKey: true, updatedAt: true },
    });
    out.recentConversations = list.map((c) => ({
      id: c.id,
      title: c.title,
      serviceKey: c.serviceKey,
      updatedAt: c.updatedAt.toISOString(),
    }));
  } catch {
    try {
      const list = await prisma.chatConversation.findMany({
        where: { userId: id },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, title: true, serviceKey: true, updatedAt: true },
      });
      out.recentConversations = list.map((c) => ({
        id: c.id,
        title: c.title,
        serviceKey: c.serviceKey,
        updatedAt: c.updatedAt.toISOString(),
      }));
    } catch {
      /* */
    }
  }

  type TimelineItem = UsageUserDetail["timeline"][number];
  const timeline: TimelineItem[] = [];

  try {
    const audits = await prisma.auditEvent.findMany({
      where: { actorId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, action: true, subject: true, entityId: true, createdAt: true },
    });
    for (const a of audits) {
      timeline.push({
        id: `audit_${a.id}`,
        kind: "audit",
        at: a.createdAt.toISOString(),
        title: activityLabel(a.action),
        detail: `${a.subject}${a.entityId ? ` · ${a.entityId.slice(0, 12)}` : ""}`,
      });
    }
  } catch {
    /* */
  }

  try {
    const txs = (await prisma.$queryRawUnsafe(
      `SELECT id, amount, source, "createdAt"
         FROM "credit_transactions"
        WHERE "userId" = $1 AND status = 'active'
        ORDER BY "createdAt" DESC
        LIMIT 40`,
      id
    )) as Array<{ id: string; amount: number; source: string; createdAt: Date }>;
    for (const t of txs) {
      timeline.push({
        id: `credit_${t.id}`,
        kind: "credit",
        at: new Date(t.createdAt).toISOString(),
        title: t.amount >= 0 ? "إضافة نقاط" : "خصم نقاط",
        detail: t.source,
        amount: t.amount,
      });
    }
  } catch {
    /* */
  }

  timeline.sort((a, b) => b.at.localeCompare(a.at));
  out.timeline = timeline.slice(0, 60);

  return out;
}
