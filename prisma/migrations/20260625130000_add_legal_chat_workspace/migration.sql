-- منصة العمل القضائية الذكية (Legal AI Workspace) — جداول الشات القضائي والمحاكاة.
-- ⚠️ حوكمة: هذه هجرة مقترحة. لا تُطبَّق على قاعدة الإنتاج إلا بإذن صريح
--    (راجع المحظورات الفنية في CLAUDE.md — db:push / migration على الإنتاج).
-- كود التطبيق يحفظ best-effort (try/catch) فيعمل حتى قبل تطبيق هذه الجداول.

-- CreateTable: simulation_cases
CREATE TABLE "simulation_cases" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT,
    "dispute_type" TEXT,
    "track_type" TEXT,
    "procedural_stage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "claim_value" TEXT,
    "has_arbitration_clause" BOOLEAN,
    "facts" JSONB,
    "parties" JSONB,
    "evidence" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "simulation_cases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "simulation_cases_user_id_idx" ON "simulation_cases"("user_id");

-- CreateTable: chat_conversations
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "case_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'RESEARCHER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations"("user_id");

-- CreateTable: chat_messages
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "extracted_intent" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- CreateTable: simulation_runs
CREATE TABLE "simulation_runs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT,
    "user_id" TEXT,
    "mode" TEXT NOT NULL,
    "output_type" TEXT,
    "input_snapshot" JSONB,
    "understood_request" JSONB,
    "user_approval_status" TEXT NOT NULL DEFAULT 'PENDING',
    "retrieved_articles" JSONB,
    "output" TEXT,
    "warnings" JSONB,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "simulation_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "simulation_runs_case_id_idx" ON "simulation_runs"("case_id");

-- Foreign keys
ALTER TABLE "simulation_cases" ADD CONSTRAINT "simulation_cases_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "simulation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_case_id_fkey"
    FOREIGN KEY ("case_id") REFERENCES "simulation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
