/**
 * تجهيز مخطط محرك الجلسات على القاعدة الحيّة (Neon عبر DATABASE_URL في Vercel).
 * نمط idempotent كـ job-store / instrumentation(clerk_id) — لأن البناء لا يشغّل migrate deploy.
 * لا يحذف بيانات. آمن لإعادة التشغيل.
 */
import { prisma } from "@/lib/prisma";

type EnsureResult = { ok: boolean; error?: string; step?: number };

const STATEMENTS: string[] = [
  // 0) جداول الأساس إن لم تكن موجودة (Neon قد لا يملك تراث legal-chat)
  `CREATE TABLE IF NOT EXISTS "chat_conversations" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'RESEARCHER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "chat_messages" (
    "id" TEXT PRIMARY KEY,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_user_id_idx" ON "chat_conversations"("user_id")`,
  `CREATE INDEX IF NOT EXISTS "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id")`,

  // 1) جداول مساعدة
  `CREATE TABLE IF NOT EXISTS "judicial_work_cases" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"        TEXT NOT NULL,
    "case_number"     TEXT,
    "court"           TEXT,
    "circuit"         TEXT,
    "jurisdiction"    TEXT NOT NULL DEFAULT 'general',
    "subject"         TEXT NOT NULL,
    "stage"           TEXT NOT NULL DEFAULT 'active',
    "confidentiality" TEXT NOT NULL DEFAULT 'normal',
    "attachments"     JSONB NOT NULL DEFAULT '[]',
    "structured"      JSONB NOT NULL DEFAULT '{}',
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "judicial_work_cases_owner_id_created_at_idx"
    ON "judicial_work_cases"("owner_id", "created_at")`,
  `CREATE TABLE IF NOT EXISTS "generation_jobs" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "owner_id"   TEXT NOT NULL,
    "kind"       TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'running',
    "title"      TEXT,
    "text"       TEXT NOT NULL DEFAULT '',
    "meta"       JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "generation_jobs_owner_idx"
    ON "generation_jobs"("owner_id","created_at")`,

  // 2) أعمدة nullable
  `ALTER TABLE "chat_conversations"
    ADD COLUMN IF NOT EXISTS "service_key" TEXT,
    ADD COLUMN IF NOT EXISTS "generated_title" TEXT,
    ADD COLUMN IF NOT EXISTS "summary" TEXT,
    ADD COLUMN IF NOT EXISTS "preview" TEXT,
    ADD COLUMN IF NOT EXISTS "state" JSONB,
    ADD COLUMN IF NOT EXISTS "status" TEXT,
    ADD COLUMN IF NOT EXISTS "case_id" TEXT,
    ADD COLUMN IF NOT EXISTS "case_file_id" TEXT,
    ADD COLUMN IF NOT EXISTS "judicial_case_id" UUID,
    ADD COLUMN IF NOT EXISTS "parent_conversation_id" TEXT,
    ADD COLUMN IF NOT EXISTS "branch_from_message_id" TEXT,
    ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3)`,
  `ALTER TABLE "chat_messages"
    ADD COLUMN IF NOT EXISTS "sequence" INTEGER,
    ADD COLUMN IF NOT EXISTS "status" TEXT,
    ADD COLUMN IF NOT EXISTS "mode" TEXT,
    ADD COLUMN IF NOT EXISTS "model" TEXT,
    ADD COLUMN IF NOT EXISTS "client_request_id" TEXT,
    ADD COLUMN IF NOT EXISTS "attachments" JSONB,
    ADD COLUMN IF NOT EXISTS "extracted_intent" JSONB,
    ADD COLUMN IF NOT EXISTS "input_snapshot" JSONB,
    ADD COLUMN IF NOT EXISTS "output_snapshot" JSONB,
    ADD COLUMN IF NOT EXISTS "tool_calls" JSONB,
    ADD COLUMN IF NOT EXISTS "retrieved_sources" JSONB,
    ADD COLUMN IF NOT EXISTS "warnings" JSONB,
    ADD COLUMN IF NOT EXISTS "job_id" UUID`,
  `ALTER TABLE "generation_jobs"
    ADD COLUMN IF NOT EXISTS "conversation_id" TEXT,
    ADD COLUMN IF NOT EXISTS "message_id" TEXT,
    ADD COLUMN IF NOT EXISTS "service_key" TEXT,
    ADD COLUMN IF NOT EXISTS "client_request_id" TEXT`,

  // 3) backfill
  `UPDATE "chat_conversations" SET "service_key" = 'legal-chat' WHERE "service_key" IS NULL`,
  `UPDATE "chat_conversations"
     SET "generated_title" = "title"
   WHERE "generated_title" IS NULL
     AND "title" IS NOT NULL
     AND btrim("title") <> ''`,
  `UPDATE "chat_conversations" SET "status" = 'active' WHERE "status" IS NULL`,
  `WITH ordered AS (
     SELECT "id",
       ROW_NUMBER() OVER (
         PARTITION BY "conversation_id"
         ORDER BY "created_at" ASC, "id" ASC
       ) AS rn
     FROM "chat_messages"
     WHERE "sequence" IS NULL
   )
   UPDATE "chat_messages" AS m
   SET "sequence" = ordered.rn
   FROM ordered
   WHERE m."id" = ordered."id"`,
  `UPDATE "chat_messages" SET "status" = 'completed' WHERE "status" IS NULL`,

  // 4) قيود
  `ALTER TABLE "chat_conversations" ALTER COLUMN "service_key" DROP DEFAULT`,
  `ALTER TABLE "chat_conversations" ALTER COLUMN "service_key" SET NOT NULL`,
  `ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_service_key_check"`,
  `ALTER TABLE "chat_conversations"
     ADD CONSTRAINT "chat_conversations_service_key_check"
     CHECK ("service_key" IN ('ask', 'judicial-assistant', 'legal-chat'))`,
  `ALTER TABLE "chat_conversations"
     ALTER COLUMN "status" SET DEFAULT 'active',
     ALTER COLUMN "status" SET NOT NULL`,
  `ALTER TABLE "chat_conversations" DROP CONSTRAINT IF EXISTS "chat_conversations_status_check"`,
  `ALTER TABLE "chat_conversations"
     ADD CONSTRAINT "chat_conversations_status_check"
     CHECK ("status" IN ('active', 'processing', 'error'))`,
  `ALTER TABLE "chat_messages" ALTER COLUMN "sequence" SET NOT NULL`,
  `ALTER TABLE "chat_messages"
     ALTER COLUMN "status" SET DEFAULT 'completed',
     ALTER COLUMN "status" SET NOT NULL`,
  `ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_status_check"`,
  `ALTER TABLE "chat_messages"
     ADD CONSTRAINT "chat_messages_status_check"
     CHECK ("status" IN ('pending', 'streaming', 'completed', 'failed', 'cancelled'))`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_client_request_uidx"
     ON "chat_messages" ("conversation_id", "client_request_id")
     WHERE "client_request_id" IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_sequence_uidx"
     ON "chat_messages" ("conversation_id", "sequence")`,

  // FKs شرطية
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cases' AND column_name='id'
      AND data_type IN ('text', 'character varying')
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_case_file_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_case_file_id_fkey"
      FOREIGN KEY ("case_file_id") REFERENCES "cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$`,
  `DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='judicial_work_cases'
      AND column_name='id' AND udt_name = 'uuid'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_judicial_case_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_judicial_case_id_fkey"
      FOREIGN KEY ("judicial_case_id") REFERENCES "judicial_work_cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_parent_conversation_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_parent_conversation_id_fkey"
      FOREIGN KEY ("parent_conversation_id") REFERENCES "chat_conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_branch_from_message_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_branch_from_message_id_fkey"
      FOREIGN KEY ("branch_from_message_id") REFERENCES "chat_messages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generation_jobs_conversation_id_fkey'
  ) THEN
    ALTER TABLE "generation_jobs"
      ADD CONSTRAINT "generation_jobs_conversation_id_fkey"
      FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generation_jobs_message_id_fkey'
  ) THEN
    ALTER TABLE "generation_jobs"
      ADD CONSTRAINT "generation_jobs_message_id_fkey"
      FOREIGN KEY ("message_id") REFERENCES "chat_messages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$`,
  `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_job_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_job_id_fkey"
      FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_conversation_client_request_uidx"
     ON "generation_jobs" ("conversation_id", "client_request_id")
     WHERE "client_request_id" IS NOT NULL AND "conversation_id" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "generation_jobs_conversation_created_idx"
     ON "generation_jobs" ("conversation_id", "created_at" DESC)
     WHERE "conversation_id" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "generation_jobs_message_id_idx"
     ON "generation_jobs" ("message_id")
     WHERE "message_id" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_updated_idx"
     ON "chat_conversations" ("user_id", "service_key", "updated_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_pinned_idx"
     ON "chat_conversations" ("user_id", "service_key", "pinned_at" DESC)
     WHERE "pinned_at" IS NOT NULL AND "deleted_at" IS NULL`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_active_idx"
     ON "chat_conversations" ("user_id", "service_key", "updated_at" DESC)
     WHERE "deleted_at" IS NULL AND "archived_at" IS NULL`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_judicial_case_updated_idx"
     ON "chat_conversations" ("judicial_case_id", "updated_at" DESC)
     WHERE "judicial_case_id" IS NOT NULL AND "deleted_at" IS NULL`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_parent_conversation_id_idx"
     ON "chat_conversations" ("parent_conversation_id")
     WHERE "parent_conversation_id" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "chat_conversations_title_lower_idx"
     ON "chat_conversations" (lower("title"))`,
  `CREATE INDEX IF NOT EXISTS "chat_messages_job_id_idx"
     ON "chat_messages" ("job_id")
     WHERE "job_id" IS NOT NULL`,
];

let ready: Promise<EnsureResult> | null = null;
let lastResult: EnsureResult = { ok: false, error: "not-run" };

function sanitizeError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return msg
    .split("\n")[0]
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[redacted]")
    .slice(0, 220);
}

/** يطبّق مخطط محرك الجلسات مرّة لكل عملية (مع إعادة المحاولة عند الفشل). */
export async function ensureConversationSessionSchema(): Promise<boolean> {
  const result = await ensureConversationSessionSchemaDetailed();
  return result.ok;
}

export async function ensureConversationSessionSchemaDetailed(): Promise<EnsureResult> {
  if (!ready) {
    ready = (async () => {
      try {
        for (let i = 0; i < STATEMENTS.length; i++) {
          try {
            await prisma.$executeRawUnsafe(STATEMENTS[i]!);
          } catch (e) {
            const err = sanitizeError(e);
            console.warn(`[conversations.schema] فشل الخطوة ${i}:`, err);
            lastResult = { ok: false, error: err, step: i };
            ready = null;
            return lastResult;
          }
        }
        lastResult = { ok: true };
        return lastResult;
      } catch (e) {
        lastResult = { ok: false, error: sanitizeError(e) };
        ready = null;
        return lastResult;
      }
    })();
  }
  return ready;
}

export function getLastConversationSchemaEnsureResult(): EnsureResult {
  return lastResult;
}

/** قراءة فقط — هل عمود service_key جاهز؟ */
export async function isConversationSessionSchemaReady(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'chat_conversations'
          AND column_name = 'service_key'`
    );
    return Number(rows[0]?.c ?? 0) > 0;
  } catch {
    return false;
  }
}
