-- 003-legal-relations.sql — إنشاء جدول legal_relations + نوع RelationType إن لم يوجدا.
-- إضافة محضة (IF NOT EXISTS) مطابقة لمخطط Prisma (model LegalRelation) — لا تمسّ أي جدول قائم.

-- نوع العلاقة (Postgres لا يدعم CREATE TYPE IF NOT EXISTS → DO block)
DO $$ BEGIN
  CREATE TYPE "RelationType" AS ENUM ('SUPPORTS','CONTRADICTS','INTERPRETS','IMPLEMENTS','SUPERSEDES','RELATED_TO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "legal_relations" (
  "id"          TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id"   TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id"   TEXT NOT NULL,
  "relation"    "RelationType" NOT NULL,
  "strength"    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "description" TEXT,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_relations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "legal_relations_source_type_source_id_idx" ON "legal_relations" ("source_type", "source_id");
CREATE INDEX IF NOT EXISTS "legal_relations_target_type_target_id_idx" ON "legal_relations" ("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "legal_relations_relation_idx" ON "legal_relations" ("relation");
