-- مركز المراجعة (المخطط السيادي §12) — جداول جديدة بالكامل، إضافيّة، لا تمسّ القائم.

DO $$ BEGIN CREATE TYPE "ReviewSessionStatus" AS ENUM ('OPEN','COMPLETED','ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FindingSeverity" AS ENUM ('INFO','LOW','MEDIUM','HIGH','CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SuggestionStatus" AS ENUM ('SUGGESTED','ACCEPTED','REJECTED','DEFERRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "review_sessions" (
  "id" TEXT PRIMARY KEY,
  "owner_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "status" "ReviewSessionStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "review_sessions_owner_id_created_at_idx" ON "review_sessions" ("owner_id","created_at");
CREATE INDEX IF NOT EXISTS "review_sessions_status_idx" ON "review_sessions" ("status");

CREATE TABLE IF NOT EXISTS "review_findings" (
  "id" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL REFERENCES "review_sessions"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "severity" "FindingSeverity" NOT NULL DEFAULT 'MEDIUM',
  "description" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '[]',
  "confidence" DOUBLE PRECISION,
  "affected_location" JSONB,
  "rule_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "review_findings_session_id_idx" ON "review_findings" ("session_id");

CREATE TABLE IF NOT EXISTS "review_suggestions" (
  "id" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL REFERENCES "review_sessions"("id") ON DELETE CASCADE,
  "finding_id" TEXT REFERENCES "review_findings"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" "SuggestionStatus" NOT NULL DEFAULT 'SUGGESTED',
  "decided_by_id" TEXT,
  "decided_at" TIMESTAMP(3),
  "decision_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "review_suggestions_session_id_status_idx" ON "review_suggestions" ("session_id","status");

CREATE TABLE IF NOT EXISTS "review_reports" (
  "id" TEXT PRIMARY KEY,
  "session_id" TEXT NOT NULL UNIQUE REFERENCES "review_sessions"("id") ON DELETE CASCADE,
  "summary" TEXT NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
