/**
 * سجل أحداث الدفع (Moyasar) — DDL ذاتي idempotent كنمط generation_jobs.
 * لا يتطلب Prisma migration على Vercel.
 */
import { prisma } from "@/lib/prisma";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "billing_events" (
    "id"         TEXT PRIMARY KEY,
    "provider"   TEXT NOT NULL DEFAULT 'moyasar',
    "event_type" TEXT,
    "status"     TEXT,
    "user_id"    TEXT,
    "plan_id"    TEXT,
    "interval"   TEXT,
    "amount"     INT,
    "currency"   TEXT,
    "payload"    JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "billing_events_user_idx"
     ON "billing_events"("user_id","created_at")`,
  `CREATE INDEX IF NOT EXISTS "billing_events_created_idx"
     ON "billing_events"("created_at" DESC)`,
];

let ready: Promise<boolean> | null = null;
async function ensure(): Promise<boolean> {
  if (!ready) {
    ready = (async () => {
      try {
        for (const s of DDL) await prisma.$executeRawUnsafe(s);
        return true;
      } catch {
        ready = null;
        return false;
      }
    })();
  }
  return ready;
}

export type BillingEventRow = {
  id: string;
  provider: string;
  eventType: string | null;
  status: string | null;
  userId: string | null;
  planId: string | null;
  interval: string | null;
  amount: number | null;
  currency: string | null;
  createdAt: string;
};

export type RecordBillingEventInput = {
  id: string;
  provider?: string;
  eventType?: string | null;
  status?: string | null;
  userId?: string | null;
  planId?: string | null;
  interval?: string | null;
  amount?: number | null;
  currency?: string | null;
  payload?: Record<string, unknown>;
};

/**
 * يسجّل الحدث مرة واحدة (ON CONFLICT DO NOTHING).
 * يعيد inserted=true إن كان جديدًا — لمنع تفعيل الاشتراك مرتين عند إعادة الإرسال.
 */
export async function recordBillingEvent(
  input: RecordBillingEventInput
): Promise<{ ok: boolean; inserted: boolean }> {
  if (!input.id || !(await ensure())) return { ok: false, inserted: false };
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `INSERT INTO "billing_events"
         ("id","provider","event_type","status","user_id","plan_id","interval","amount","currency","payload")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::jsonb,'{}'::jsonb))
       ON CONFLICT ("id") DO NOTHING
       RETURNING "id"`,
      input.id,
      input.provider || "moyasar",
      input.eventType ?? null,
      input.status ?? null,
      input.userId ?? null,
      input.planId ?? null,
      input.interval ?? null,
      input.amount ?? null,
      input.currency ?? null,
      input.payload ? JSON.stringify(input.payload) : null
    )) as Array<{ id: string }>;
    return { ok: true, inserted: Boolean(rows[0]?.id) };
  } catch {
    return { ok: false, inserted: false };
  }
}

export async function listRecentBillingEvents(limit = 40): Promise<BillingEventRow[]> {
  if (!(await ensure())) return [];
  const take = Math.min(Math.max(limit, 1), 100);
  try {
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT "id","provider","event_type","status","user_id","plan_id","interval","amount","currency","created_at"
         FROM "billing_events"
        ORDER BY "created_at" DESC
        LIMIT $1`,
      take
    )) as Array<{
      id: string;
      provider: string;
      event_type: string | null;
      status: string | null;
      user_id: string | null;
      plan_id: string | null;
      interval: string | null;
      amount: number | null;
      currency: string | null;
      created_at: Date;
    }>;
    return rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      eventType: r.event_type,
      status: r.status,
      userId: r.user_id,
      planId: r.plan_id,
      interval: r.interval,
      amount: r.amount,
      currency: r.currency,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  } catch {
    return [];
  }
}

/** تحقق ناعم من سر Moyasar — يُفعَّل فقط عند ضبط MOYASAR_WEBHOOK_SECRET. */
export function verifyMoyasarWebhookSecret(body: unknown): {
  ok: boolean;
  enforced: boolean;
  reason?: string;
} {
  const expected = (process.env.MOYASAR_WEBHOOK_SECRET || "").trim();
  if (!expected) return { ok: true, enforced: false };

  const token =
    body && typeof body === "object"
      ? String(
          (body as { secret_token?: string; secret?: string }).secret_token ||
            (body as { secret?: string }).secret ||
            ""
        ).trim()
      : "";

  if (!token) return { ok: false, enforced: true, reason: "missing_secret" };
  if (token !== expected) return { ok: false, enforced: true, reason: "secret_mismatch" };
  return { ok: true, enforced: true };
}
