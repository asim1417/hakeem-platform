-- ============================================================================
-- مقترح فقط — لا يُنفَّذ دون إذن صريح.
-- اسم مقترح: 20260725160000_conversation_session_engine
-- الهدف: توسيع chat_conversations / chat_messages لمحرك جلسات موحّد
--        مع service_key دون توحيد محتوى الخدمات ودون تغيير منطق الذكاء.
-- ============================================================================

-- ── 1) محادثات: أعمدة الإدارة والهوية ───────────────────────────────────────
ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "service_key" TEXT,
  ADD COLUMN IF NOT EXISTS "title_override" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "preview" TEXT,
  ADD COLUMN IF NOT EXISTS "state" JSONB,
  ADD COLUMN IF NOT EXISTS "case_file_id" TEXT,
  ADD COLUMN IF NOT EXISTS "judicial_case_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_id" TEXT,
  ADD COLUMN IF NOT EXISTS "parent_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- ترحيل الصفوف الحالية (legal-chat التراثي)
UPDATE "chat_conversations"
SET "service_key" = 'legal-chat'
WHERE "service_key" IS NULL;

-- بعد الترحيل: إلزامية service_key للصفوف الجديدة/القائمة
ALTER TABLE "chat_conversations"
  ALTER COLUMN "service_key" SET DEFAULT 'legal-chat',
  ALTER COLUMN "service_key" SET NOT NULL;

-- قيود القيم المسموحة
ALTER TABLE "chat_conversations"
  DROP CONSTRAINT IF EXISTS "chat_conversations_service_key_check";
ALTER TABLE "chat_conversations"
  ADD CONSTRAINT "chat_conversations_service_key_check"
  CHECK ("service_key" IN ('ask', 'judicial-assistant', 'legal-chat'));

-- mode يبقى نصًا حرًا مفسَّرًا حسب service_key:
--   ask                 → ask|analyze-case|action-plan|verdict-estimate|consultation|chat
--   judicial-assistant  → معرّف مهمة/سياق جلسة (اختياري)
--   legal-chat          → RESEARCHER|JUDGE|… (التراث)
-- لا نغيّر DEFAULT الحالي 'RESEARCHER' في هذه المهاجرة لتفادي كسر المسار التراثي.

-- ── 2) رسائل: ترتيب وسياق وتشغيل ────────────────────────────────────────────
ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "sequence" INTEGER,
  ADD COLUMN IF NOT EXISTS "mode" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "input_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "output_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "tool_calls" JSONB,
  ADD COLUMN IF NOT EXISTS "retrieved_sources" JSONB,
  ADD COLUMN IF NOT EXISTS "warnings" JSONB,
  ADD COLUMN IF NOT EXISTS "job_id" TEXT;

-- ترحيل sequence للرسائل القديمة حسب created_at داخل كل محادثة
WITH ordered AS (
  SELECT
    "id",
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
WHERE m."id" = ordered."id";

-- إلزامية sequence بعد الترحيل
ALTER TABLE "chat_messages"
  ALTER COLUMN "sequence" SET NOT NULL;

-- ── 3) مفاتيح أجنبية (اختياريّة / آمنة) ─────────────────────────────────────
-- CaseFile (جدول cases) — TEXT cuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_case_file_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_case_file_id_fkey"
      FOREIGN KEY ("case_file_id") REFERENCES "cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- JudicialWorkCase — UUID؛ الجدول قد يُنشأ بسكربت idempotent في بعض البيئات
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'judicial_work_cases'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_judicial_case_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_judicial_case_id_fkey"
      FOREIGN KEY ("judicial_case_id") REFERENCES "judicial_work_cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- تفريع: أصل الجلسة
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_parent_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "chat_conversations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- تفريع: رسالة الأصل
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chat_conversations_parent_message_id_fkey'
  ) THEN
    ALTER TABLE "chat_conversations"
      ADD CONSTRAINT "chat_conversations_parent_message_id_fkey"
      FOREIGN KEY ("parent_message_id") REFERENCES "chat_messages"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── 4) فهارس للأداء (قائمة / بحث إداري / مثبتات) ────────────────────────────
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

CREATE INDEX IF NOT EXISTS "chat_conversations_parent_id_idx"
  ON "chat_conversations" ("parent_id")
  WHERE "parent_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_conversation_sequence_uidx"
  ON "chat_messages" ("conversation_id", "sequence");

CREATE INDEX IF NOT EXISTS "chat_messages_job_id_idx"
  ON "chat_messages" ("job_id")
  WHERE "job_id" IS NOT NULL;

-- بحث عناوين (آمن بلا امتدادات). trigram اختياري لاحقًا إن فُعّل pg_trgm.
CREATE INDEX IF NOT EXISTS "chat_conversations_title_lower_idx"
  ON "chat_conversations" (lower(coalesce("title_override", "title")));

-- اختياري لاحقًا فقط (يتطلب CREATE EXTENSION pg_trgm):
-- CREATE INDEX IF NOT EXISTS "chat_conversations_title_trgm_idx"
--   ON "chat_conversations" USING gin (lower(coalesce("title_override", "title")) gin_trgm_ops);

-- ============================================================================
-- خارج النطاق المتعمّد لهذه المهاجرة:
-- - لا تعديل على simulation_runs / منطق الكتابة فيها
-- - لا تعديل على /api/ai/agent-search
-- - لا إصلاح extractedText في attachments
-- - لا إنشاء صفوف محادثة فارغة
-- ============================================================================
