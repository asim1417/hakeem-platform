-- ============================================================================
-- الخطوة 1/4 — إضافة أعمدة nullable فقط
-- مقترح — لا يُنفَّذ دون إذن صريح.
-- لا DEFAULT على service_key. لا NOT NULL. لا CHECK صارم بعد.
-- ============================================================================

-- ── chat_conversations ──────────────────────────────────────────────────────
ALTER TABLE "chat_conversations"
  ADD COLUMN IF NOT EXISTS "service_key" TEXT,
  ADD COLUMN IF NOT EXISTS "generated_title" TEXT,
  ADD COLUMN IF NOT EXISTS "summary" TEXT,
  ADD COLUMN IF NOT EXISTS "preview" TEXT,
  ADD COLUMN IF NOT EXISTS "state" JSONB,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "case_file_id" TEXT,
  ADD COLUMN IF NOT EXISTS "judicial_case_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_conversation_id" TEXT,
  ADD COLUMN IF NOT EXISTS "branch_from_message_id" TEXT,
  ADD COLUMN IF NOT EXISTS "pinned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- ملاحظة: عمود "title" الحالي يبقى عنوان العرض (قابل لإعادة التسمية).
-- "generated_title" يحفظ العنوان التلقائي الأصلي ولا يُستبدل عند إعادة التسمية.

-- ── chat_messages ───────────────────────────────────────────────────────────
ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "sequence" INTEGER,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "mode" TEXT,
  ADD COLUMN IF NOT EXISTS "model" TEXT,
  ADD COLUMN IF NOT EXISTS "client_request_id" TEXT,
  ADD COLUMN IF NOT EXISTS "input_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "output_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "tool_calls" JSONB,
  ADD COLUMN IF NOT EXISTS "retrieved_sources" JSONB,
  ADD COLUMN IF NOT EXISTS "warnings" JSONB,
  ADD COLUMN IF NOT EXISTS "job_id" UUID;

-- ── generation_jobs — ربط حقيقي بالمحادثة/الرسالة ───────────────────────────
-- الجدول يُنشأ غالبًا بـ DDL ذاتي في job-store؛ نضيف الأعمدة إن وُجد الجدول.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'generation_jobs'
  ) THEN
    ALTER TABLE "generation_jobs"
      ADD COLUMN IF NOT EXISTS "conversation_id" TEXT,
      ADD COLUMN IF NOT EXISTS "message_id" TEXT,
      ADD COLUMN IF NOT EXISTS "service_key" TEXT,
      ADD COLUMN IF NOT EXISTS "client_request_id" TEXT;
  END IF;
END $$;
