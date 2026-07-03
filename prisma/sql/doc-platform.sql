-- تهيئة جدولَي منصة الوثائق فقط — آمنة وغير متلفة (IF NOT EXISTS).
-- لا تمسّ أي جدول قائم؛ تُشغَّل عبر: prisma db execute (workflow: Doc Platform DB Push).

CREATE TABLE IF NOT EXISTS "doc_workspaces" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "token"      TEXT NOT NULL,
  "prefs"      JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "doc_workspaces_token_key" ON "doc_workspaces" ("token");

CREATE TABLE IF NOT EXISTS "doc_cases" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "title"        TEXT NOT NULL,
  "docs"         JSONB NOT NULL,
  "annotations"  JSONB,
  "doc_count"    INTEGER NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "doc_cases_workspace_id_idx" ON "doc_cases" ("workspace_id");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'doc_cases_workspace_id_fkey') THEN
    ALTER TABLE "doc_cases"
      ADD CONSTRAINT "doc_cases_workspace_id_fkey"
      FOREIGN KEY ("workspace_id") REFERENCES "doc_workspaces" ("id") ON DELETE CASCADE;
  END IF;
END $$;
