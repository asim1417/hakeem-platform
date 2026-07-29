/**
 * عدّاد استهلاك مفتاح Claude / المزوّدين — جدول ai_usage_events + سياق الطلب.
 * التاريخ القديم: تقديرات من audit_logs؛ الجديد: رموز Anthropic الفعلية.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "@/lib/prisma";

export type AiUsageContext = {
  userId?: string | null;
  serviceKey?: string | null;
  requestId?: string | null;
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type AiUsageRecordInput = {
  userId: string;
  provider: string;
  model?: string | null;
  serviceKey?: string | null;
  requestId?: string | null;
  inputTokens: number;
  outputTokens: number;
  streamed?: boolean;
};

const als = new AsyncLocalStorage<AiUsageContext>();

let schemaReady: Promise<boolean> | null = null;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "ai_usage_events" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT,
  "service_key" TEXT,
  "request_id" TEXT,
  "input_tokens" INT NOT NULL DEFAULT 0,
  "output_tokens" INT NOT NULL DEFAULT 0,
  "streamed" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_events_user_created_idx"
  ON "ai_usage_events" ("user_id", "created_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "ai_usage_events_provider_idx"
  ON "ai_usage_events" ("provider")`,
];

export function getAiUsageContext(): AiUsageContext | undefined {
  return als.getStore();
}

/** يضبط السياق لبقية سلسلة الوعود في نفس الطلب (مناسب لمسارات Next). */
export function enterAiUsageContext(ctx: AiUsageContext): void {
  als.enterWith(ctx);
}

export function runWithAiUsageContext<T>(ctx: AiUsageContext, fn: () => T): T {
  return als.run(ctx, fn);
}

export async function ensureAiUsageSchema(): Promise<boolean> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    try {
      for (const sql of STATEMENTS) {
        await prisma.$executeRawUnsafe(sql);
      }
      return true;
    } catch {
      schemaReady = null;
      return false;
    }
  })();
  return schemaReady;
}

export async function recordAiUsage(input: AiUsageRecordInput): Promise<void> {
  const userId = input.userId?.trim();
  if (!userId) return;
  const inputTokens = Math.max(0, Math.floor(Number(input.inputTokens) || 0));
  const outputTokens = Math.max(0, Math.floor(Number(input.outputTokens) || 0));
  if (inputTokens === 0 && outputTokens === 0) return;

  const ok = await ensureAiUsageSchema();
  if (!ok) return;

  const id = `aiu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ai_usage_events"
        ("id","user_id","provider","model","service_key","request_id","input_tokens","output_tokens","streamed")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      id,
      userId,
      (input.provider || "unknown").slice(0, 40),
      input.model ? String(input.model).slice(0, 120) : null,
      input.serviceKey ? String(input.serviceKey).slice(0, 80) : null,
      input.requestId ? String(input.requestId).slice(0, 80) : null,
      inputTokens,
      outputTokens,
      Boolean(input.streamed)
    );
  } catch {
    /* لا نكسر مسار الذكاء إن فشل التسجيل */
  }
}

/** يسجّل إن وُجد مستخدم في سياق ALS أو مُمرَّر صراحةً. */
export async function recordAiUsageFromContext(
  usage: AiTokenUsage,
  meta: { provider: string; model?: string | null; streamed?: boolean; userId?: string | null; serviceKey?: string | null; requestId?: string | null }
): Promise<void> {
  const ctx = getAiUsageContext();
  const userId = meta.userId || ctx?.userId;
  if (!userId) return;
  await recordAiUsage({
    userId,
    provider: meta.provider,
    model: meta.model,
    serviceKey: meta.serviceKey ?? ctx?.serviceKey,
    requestId: meta.requestId ?? ctx?.requestId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    streamed: meta.streamed,
  });
}

export type UserClaudeAggregate = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

/** تجميع رموز Claude الفعلية لمجموعة مستخدمين. */
export async function getClaudeUsageAggregates(
  userIds: string[]
): Promise<Map<string, UserClaudeAggregate>> {
  const map = new Map<string, UserClaudeAggregate>();
  if (!userIds.length) return map;
  try {
    const ok = await ensureAiUsageSchema();
    if (!ok) return map;
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "user_id" AS uid,
              COUNT(*)::int AS calls,
              COALESCE(SUM("input_tokens"),0)::int AS inp,
              COALESCE(SUM("output_tokens"),0)::int AS outp
         FROM "ai_usage_events"
        WHERE "user_id" = ANY($1::text[])
          AND "provider" = 'anthropic'
        GROUP BY "user_id"`,
      userIds
    )) as Array<{ uid: string; calls: number; inp: number; outp: number }>;
    for (const r of rows) {
      const inputTokens = Number(r.inp) || 0;
      const outputTokens = Number(r.outp) || 0;
      map.set(r.uid, {
        calls: Number(r.calls) || 0,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      });
    }
  } catch {
    /* */
  }
  return map;
}

/** تقديرات تاريخية من metadata في audit_logs (tokenEstimate + provider). */
export async function getClaudeAuditProxies(userIds: string[]): Promise<
  Map<string, { calls: number; tokenEstimate: number }>
> {
  const map = new Map<string, { calls: number; tokenEstimate: number }>();
  if (!userIds.length) return map;
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "actorId" AS uid,
              COUNT(*)::int AS calls,
              COALESCE(SUM(
                CASE
                  WHEN metadata ? 'tokenEstimate'
                    THEN NULLIF(metadata->>'tokenEstimate','')::int
                  ELSE 0
                END
              ),0)::int AS est
         FROM "audit_logs"
        WHERE "actorId" = ANY($1::text[])
          AND (
            (metadata->>'provider') = 'anthropic'
            OR (
              subject::text = 'AI_GATEWAY'
              AND COALESCE(metadata->>'provider','') IN ('anthropic','')
            )
          )
          AND (
            subject::text = 'AI_GATEWAY'
            OR action LIKE 'JA_ASK%'
            OR action = 'LEGAL_CHAT_TURN'
            OR action LIKE 'AI_%'
            OR action LIKE 'ORIGINAL_HAKEEM_AI%'
          )
        GROUP BY "actorId"`,
      userIds
    )) as Array<{ uid: string; calls: number; est: number }>;
    for (const r of rows) {
      map.set(r.uid, {
        calls: Number(r.calls) || 0,
        tokenEstimate: Number(r.est) || 0,
      });
    }
  } catch {
    try {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "actorId" AS uid, COUNT(*)::int AS calls
           FROM "audit_logs"
          WHERE "actorId" = ANY($1::text[])
            AND (
              subject::text = 'AI_GATEWAY'
              OR action LIKE 'JA_ASK%'
              OR action = 'LEGAL_CHAT_TURN'
            )
          GROUP BY "actorId"`,
        userIds
      )) as Array<{ uid: string; calls: number }>;
      for (const r of rows) {
        map.set(r.uid, { calls: Number(r.calls) || 0, tokenEstimate: 0 });
      }
    } catch {
      /* */
    }
  }
  return map;
}
