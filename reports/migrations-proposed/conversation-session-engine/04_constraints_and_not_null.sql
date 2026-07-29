-- ============================================================================
-- الخطوة 4/4 — القيود و NOT NULL بعد الترحيل وتحديث التطبيق
-- مقترح — لا يُنفَّذ دون إذن صريح وبعد نجاح preflight + بوابة التطبيق.
-- مهم: لا يُضاف DEFAULT لـ service_key. التطبيق ملزم بتمرير القيمة صراحة.
-- ============================================================================

-- تأكيد عدم بقاء قيم فارغة قبل التشديد
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "chat_conversations" WHERE "service_key" IS NULL) THEN
    RAISE EXCEPTION 'backfill incomplete: chat_conversations.service_key contains NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM "chat_messages" WHERE "sequence" IS NULL) THEN
    RAISE EXCEPTION 'backfill incomplete: chat_messages.sequence contains NULL';
  END IF;
END $$;

-- ── service_key: إلزامي بلا DEFAULT ─────────────────────────────────────────
ALTER TABLE "chat_conversations"
  ALTER COLUMN "service_key" DROP DEFAULT;

ALTER TABLE "chat_conversations"
  ALTER COLUMN "service_key" SET NOT NULL;

ALTER TABLE "chat_conversations"
  DROP CONSTRAINT IF EXISTS "chat_conversations_service_key_check";
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_service_key_check"
  CHECK ("service_key" IN ('ask', 'judicial-assistant', 'legal-chat'));

-- ── status على المحادثة ─────────────────────────────────────────────────────
UPDATE "chat_conversations" SET "status" = 'active' WHERE "status" IS NULL;
ALTER TABLE "chat_conversations"
  ALTER COLUMN "status" SET DEFAULT 'active',
  ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "chat_conversations"
  DROP CONSTRAINT IF EXISTS "chat_conversations_status_check";
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_status_check"
  CHECK ("status" IN ('active', 'processing', 'error'));

-- ── sequence + status على الرسائل ───────────────────────────────────────────
ALTER TABLE "chat_messages"
  ALTER COLUMN "sequence" SET NOT NULL;

UPDATE "chat_messages" SET "status" = 'completed' WHERE "status" IS NULL;
ALTER TABLE "chat_messages"
  ALTER COLUMN "status" SET DEFAULT 'completed',
  ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "chat_messages"
  DROP CONSTRAINT IF EXISTS "chat_messages_status_check";
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_status_check"
  CHECK ("status" IN ('pending', 'streaming', 'completed', 'failed', 'cancelled'));

-- ── منع تكرار الرسائل (idempotency) ─────────────────────────────────────────
-- يسمح بعدة رسائل بلا مفتاح؛ يمنع تكرار نفس client_request_id داخل المحادثة.
CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_client_request_uidx"
  ON "chat_messages" ("conversation_id", "client_request_id")
  WHERE "client_request_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_sequence_uidx"
  ON "chat_messages" ("conversation_id", "sequence");

-- ── FKs بعد التحقق من الأنواع في preflight ──────────────────────────────────
-- CaseFile → cases.id (TEXT cuid متوقع)
DO $$
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
END $$;

-- JudicialWorkCase → judicial_work_cases.id (UUID متوقع)
DO $$
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
END $$;

-- تفريع
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_parent_conversation_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_parent_conversation_id_fkey"
      FOREIGN KEY ("parent_conversation_id") REFERENCES "chat_conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_branch_from_message_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_branch_from_message_id_fkey"
      FOREIGN KEY ("branch_from_message_id") REFERENCES "chat_messages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- generation_jobs ↔ المحادثة/الرسالة (إن وُجد الجدول)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='generation_jobs'
  ) THEN
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

    -- منع تكرار مهمة لنفس طلب العميل داخل المحادثة
    CREATE UNIQUE INDEX IF NOT EXISTS "generation_jobs_conversation_client_request_uidx"
      ON "generation_jobs" ("conversation_id", "client_request_id")
      WHERE "client_request_id" IS NOT NULL AND "conversation_id" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS "generation_jobs_conversation_created_idx"
      ON "generation_jobs" ("conversation_id", "created_at" DESC)
      WHERE "conversation_id" IS NOT NULL;

    CREATE INDEX IF NOT EXISTS "generation_jobs_message_id_idx"
      ON "generation_jobs" ("message_id")
      WHERE "message_id" IS NOT NULL;
  END IF;
END $$;

-- ربط عكسي اختياري: message.job_id → generation_jobs.id (UUID)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='generation_jobs'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_job_id_fkey'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_job_id_fkey"
      FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── فهارس القائمة ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_updated_idx"
  ON "chat_conversations" ("user_id", "service_key", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_pinned_idx"
  ON "chat_conversations" ("user_id", "service_key", "pinned_at" DESC)
  WHERE "pinned_at" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_user_service_active_idx"
  ON "chat_conversations" ("user_id", "service_key", "updated_at" DESC)
  WHERE "deleted_at" IS NULL AND "archived_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_judicial_case_updated_idx"
  ON "chat_conversations" ("judicial_case_id", "updated_at" DESC)
  WHERE "judicial_case_id" IS NOT NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_parent_conversation_id_idx"
  ON "chat_conversations" ("parent_conversation_id")
  WHERE "parent_conversation_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "chat_conversations_title_lower_idx"
  ON "chat_conversations" (lower("title"));

CREATE INDEX IF NOT EXISTS "chat_messages_job_id_idx"
  ON "chat_messages" ("job_id")
  WHERE "job_id" IS NOT NULL;
