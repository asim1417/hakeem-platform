/**
 * رصد الأسبوع الماضي — بيانات مؤكّدة من جداول لها طابع زمني فقط.
 * لا يدّعي زيارات صفحات ولا رموز Claude غير المسجّلة.
 */
import { prisma } from "@/lib/prisma";
import { pastWeekWindow } from "@/lib/modules/billing/users-usage-snapshot";
import {
  ensureAiUsageSchema,
  getClaudeUsageAggregates,
} from "@/lib/modules/billing/ai-usage-meter";

export type EvidenceLevel = "verified" | "partial" | "unavailable";

export type WeekVerifiedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  isActive: boolean;
  creditsSpent: number;
  creditSources: Array<{ source: string; amount: number }>;
  consultationsCreated: number;
  simulationsCreated: number;
  /** رسائل مستخدم في المحادثات خلال النافذة */
  chatUserMessages: number;
  chatAssistantMessages: number;
  askUserMessages: number;
  legalChatUserMessages: number;
  jaUserMessages: number;
  /** أحداث تدقيق ذكاء مؤكّدة الوجود */
  aiAuditEvents: number;
  /** رموز Anthropic الفعلية إن وُجدت في ai_usage_events */
  claudeCalls: number;
  claudeInputTokens: number;
  claudeOutputTokens: number;
  claudeTokensVerified: boolean;
  activityScore: number;
};

export type WeekVerifiedReport = {
  from: string;
  to: string;
  generatedAt: string;
  limitations: string[];
  summary: {
    usersWithActivity: number;
    creditsSpent: number;
    consultationsCreated: number;
    simulationsCreated: number;
    chatUserMessages: number;
    aiAuditEvents: number;
    claudeCallsVerified: number;
    claudeInputTokens: number;
    claudeOutputTokens: number;
  };
  evidence: Array<{
    metric: string;
    level: EvidenceLevel;
    note: string;
  }>;
  users: WeekVerifiedUser[];
};

async function mapCount(
  sql: string,
  params: unknown[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
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

export async function getWeekVerifiedReport(): Promise<WeekVerifiedReport> {
  const { from, to } = pastWeekWindow();
  const generatedAt = new Date().toISOString();
  const limitations = [
    "لا توجد سجلات زيارات صفحات (pageviews) محفوظة — لا يُعرض «من فتح الموقع» كحقيقة.",
    "الحصّة المجانية مخزّنة كعداد تراكمي بلا دفتر يومي — لا يمكن إثبات «كم وحدة مجانية هذا الأسبوع» بدقة.",
    "رموز Claude الفعلية متوفرة فقط للنداءات التي مُرِّرت عبر العدّاد بعد تفعيله؛ الباقي يظهر كأحداث تدقيق بلا فاتورة رموز.",
    "عنوان IP لم يُحفظ تاريخيًا — لا يمكن تفصيل الأسبوع الماضي حسب IP.",
  ];

  const evidence: WeekVerifiedReport["evidence"] = [
    {
      metric: "نقاط مخصومة",
      level: "verified",
      note: "من credit_transactions (amount < 0) داخل النافذة الزمنية.",
    },
    {
      metric: "استشارات / محاكاة منشأة",
      level: "verified",
      note: "عدّ سجلات consultations و simulation_sessions حسب createdAt.",
    },
    {
      metric: "رسائل المحادثة",
      level: "verified",
      note: "عدّ chat_messages حسب created_at مع ربط service_key — أقرب لنشاط فعلي من عدّ المحادثات.",
    },
    {
      metric: "أحداث ذكاء (تدقيق)",
      level: "partial",
      note: "يثبت حدوث حدث AI في audit_logs، ولا يساوي فاتورة Anthropic.",
    },
    {
      metric: "رموز Claude",
      level: "partial",
      note: "مؤكّد فقط من ai_usage_events؛ إن صفر فقد يكون الاستهلاك غير مُسجَّل.",
    },
  ];

  const emptySummary = {
    usersWithActivity: 0,
    creditsSpent: 0,
    consultationsCreated: 0,
    simulationsCreated: 0,
    chatUserMessages: 0,
    aiAuditEvents: 0,
    claudeCallsVerified: 0,
    claudeInputTokens: 0,
    claudeOutputTokens: 0,
  };

  let usersMeta: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    isActive: boolean;
  }> = [];
  try {
    usersMeta = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true },
      take: 2000,
    });
  } catch {
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      generatedAt,
      limitations,
      summary: emptySummary,
      evidence,
      users: [],
    };
  }

  const ids = usersMeta.map((u) => u.id);
  await ensureAiUsageSchema().catch(() => false);

  const [
    credits,
    creditSourcesRows,
    consultations,
    simulations,
    chatUser,
    chatAssistant,
    askMsgs,
    legalMsgs,
    jaMsgs,
    aiAudits,
    claudeAgg,
  ] = await Promise.all([
    mapCount(
      `SELECT "userId" AS uid, COALESCE(SUM(ABS(amount)),0)::int AS c
         FROM "credit_transactions"
        WHERE "userId" = ANY($1::text[])
          AND amount < 0 AND status = 'active'
          AND "createdAt" >= $2::timestamptz AND "createdAt" <= $3::timestamptz
        GROUP BY "userId"`,
      [ids, from, to]
    ),
    (async () => {
      try {
        return (await prisma.$queryRawUnsafe(
          `SELECT "userId" AS uid, source, COALESCE(SUM(ABS(amount)),0)::int AS c
             FROM "credit_transactions"
            WHERE "userId" = ANY($1::text[])
              AND amount < 0 AND status = 'active'
              AND "createdAt" >= $2::timestamptz AND "createdAt" <= $3::timestamptz
            GROUP BY "userId", source`,
          ids,
          from,
          to
        )) as Array<{ uid: string; source: string; c: number }>;
      } catch {
        return [] as Array<{ uid: string; source: string; c: number }>;
      }
    })(),
    mapCount(
      `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "consultations"
        WHERE "userId" = ANY($1::text[])
          AND "createdAt" >= $2::timestamptz AND "createdAt" <= $3::timestamptz
        GROUP BY "userId"`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT "userId" AS uid, COUNT(*)::int AS c FROM "simulation_sessions"
        WHERE "userId" = ANY($1::text[])
          AND "createdAt" >= $2::timestamptz AND "createdAt" <= $3::timestamptz
        GROUP BY "userId"`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT c.user_id AS uid, COUNT(*)::int AS c
         FROM "chat_messages" m
         JOIN "chat_conversations" c ON c.id = m.conversation_id
        WHERE c.user_id = ANY($1::text[])
          AND m.role = 'user'
          AND m.created_at >= $2::timestamptz AND m.created_at <= $3::timestamptz
        GROUP BY c.user_id`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT c.user_id AS uid, COUNT(*)::int AS c
         FROM "chat_messages" m
         JOIN "chat_conversations" c ON c.id = m.conversation_id
        WHERE c.user_id = ANY($1::text[])
          AND m.role = 'assistant'
          AND m.created_at >= $2::timestamptz AND m.created_at <= $3::timestamptz
        GROUP BY c.user_id`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT c.user_id AS uid, COUNT(*)::int AS c
         FROM "chat_messages" m
         JOIN "chat_conversations" c ON c.id = m.conversation_id
        WHERE c.user_id = ANY($1::text[])
          AND c.service_key = 'ask'
          AND m.role = 'user'
          AND m.created_at >= $2::timestamptz AND m.created_at <= $3::timestamptz
        GROUP BY c.user_id`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT c.user_id AS uid, COUNT(*)::int AS c
         FROM "chat_messages" m
         JOIN "chat_conversations" c ON c.id = m.conversation_id
        WHERE c.user_id = ANY($1::text[])
          AND c.service_key = 'legal-chat'
          AND m.role = 'user'
          AND m.created_at >= $2::timestamptz AND m.created_at <= $3::timestamptz
        GROUP BY c.user_id`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT c.user_id AS uid, COUNT(*)::int AS c
         FROM "chat_messages" m
         JOIN "chat_conversations" c ON c.id = m.conversation_id
        WHERE c.user_id = ANY($1::text[])
          AND c.service_key = 'judicial-assistant'
          AND m.role = 'user'
          AND m.created_at >= $2::timestamptz AND m.created_at <= $3::timestamptz
        GROUP BY c.user_id`,
      [ids, from, to]
    ),
    mapCount(
      `SELECT "actorId" AS uid, COUNT(*)::int AS c FROM "audit_logs"
        WHERE "actorId" = ANY($1::text[])
          AND "createdAt" >= $2::timestamptz AND "createdAt" <= $3::timestamptz
          AND (
            subject::text = 'AI_GATEWAY'
            OR action LIKE 'JA_ASK%'
            OR action = 'LEGAL_CHAT_TURN'
            OR action LIKE 'AI_%'
            OR action LIKE 'ORIGINAL_HAKEEM_AI%'
          )
        GROUP BY "actorId"`,
      [ids, from, to]
    ),
    getClaudeUsageAggregates(ids, { since: from }),
  ]);

  const sourcesByUser = new Map<string, Array<{ source: string; amount: number }>>();
  for (const r of creditSourcesRows) {
    const list = sourcesByUser.get(r.uid) ?? [];
    list.push({ source: r.source || "unknown", amount: Number(r.c) || 0 });
    sourcesByUser.set(r.uid, list);
  }

  const users: WeekVerifiedUser[] = [];
  for (const u of usersMeta) {
    const creditsSpent = credits.get(u.id) ?? 0;
    const consultationsCreated = consultations.get(u.id) ?? 0;
    const simulationsCreated = simulations.get(u.id) ?? 0;
    const chatUserMessages = chatUser.get(u.id) ?? 0;
    const chatAssistantMessages = chatAssistant.get(u.id) ?? 0;
    const askUserMessages = askMsgs.get(u.id) ?? 0;
    const legalChatUserMessages = legalMsgs.get(u.id) ?? 0;
    const jaUserMessages = jaMsgs.get(u.id) ?? 0;
    const aiAuditEvents = aiAudits.get(u.id) ?? 0;
    const claude = claudeAgg.get(u.id);
    const claudeCalls = claude?.calls ?? 0;
    const claudeInputTokens = claude?.inputTokens ?? 0;
    const claudeOutputTokens = claude?.outputTokens ?? 0;
    const activityScore =
      creditsSpent +
      consultationsCreated +
      simulationsCreated +
      chatUserMessages +
      aiAuditEvents +
      claudeCalls;
    if (activityScore <= 0) continue;
    users.push({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      creditsSpent,
      creditSources: (sourcesByUser.get(u.id) ?? []).sort((a, b) => b.amount - a.amount),
      consultationsCreated,
      simulationsCreated,
      chatUserMessages,
      chatAssistantMessages,
      askUserMessages,
      legalChatUserMessages,
      jaUserMessages,
      aiAuditEvents,
      claudeCalls,
      claudeInputTokens,
      claudeOutputTokens,
      claudeTokensVerified: claudeCalls > 0,
      activityScore,
    });
  }

  users.sort((a, b) => b.activityScore - a.activityScore);

  const summary = {
    usersWithActivity: users.length,
    creditsSpent: users.reduce((s, u) => s + u.creditsSpent, 0),
    consultationsCreated: users.reduce((s, u) => s + u.consultationsCreated, 0),
    simulationsCreated: users.reduce((s, u) => s + u.simulationsCreated, 0),
    chatUserMessages: users.reduce((s, u) => s + u.chatUserMessages, 0),
    aiAuditEvents: users.reduce((s, u) => s + u.aiAuditEvents, 0),
    claudeCallsVerified: users.reduce((s, u) => s + u.claudeCalls, 0),
    claudeInputTokens: users.reduce((s, u) => s + u.claudeInputTokens, 0),
    claudeOutputTokens: users.reduce((s, u) => s + u.claudeOutputTokens, 0),
  };

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt,
    limitations,
    summary,
    evidence,
    users,
  };
}

export function weekVerifiedToCsv(report: WeekVerifiedReport): string {
  const header = [
    "userId",
    "name",
    "email",
    "role",
    "creditsSpent",
    "creditSources",
    "consultationsCreated",
    "simulationsCreated",
    "chatUserMessages",
    "askUserMessages",
    "legalChatUserMessages",
    "jaUserMessages",
    "aiAuditEvents",
    "claudeCallsVerified",
    "claudeInputTokens",
    "claudeOutputTokens",
    "from",
    "to",
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const u of report.users) {
    lines.push(
      [
        u.id,
        u.name,
        u.email,
        u.role,
        u.creditsSpent,
        u.creditSources.map((x) => `${x.source}:${x.amount}`).join("|"),
        u.consultationsCreated,
        u.simulationsCreated,
        u.chatUserMessages,
        u.askUserMessages,
        u.legalChatUserMessages,
        u.jaUserMessages,
        u.aiAuditEvents,
        u.claudeCalls,
        u.claudeInputTokens,
        u.claudeOutputTokens,
        report.from,
        report.to,
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
}
