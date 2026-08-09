-- وكيل تحديث قاعدة الأنظمة — طبقة الأمانة الكاملة. جداول جديدة بالكامل + عمود واحد
-- إضافيّ على legal_systems بقيمة افتراضية. إضافيّة تمامًا، لا حذف ولا تعديل هدمي.
-- آمنة للتكرار (idempotent) على نمط الهجرات القائمة.

-- ── Enums ──
DO $$ BEGIN CREATE TYPE "DocumentType" AS ENUM ('ROYAL_DECREE','COUNCIL_DECISION','AGENCY_DECISION','SYSTEM_TEXT','BYLAW'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocUnitType" AS ENUM ('INSTRUMENT_OPENING','RECITAL','INSTRUMENT_CLAUSE','INSTRUMENT_CLOSING','SIGNATURE','SYSTEM_PREAMBLE','PART','CHAPTER','SECTION','ARTICLE','PARAGRAPH','SUBPARAGRAPH','DEFINITION_ITEM','UNCLASSIFIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocUnitStatus" AS ENUM ('IN_FORCE','AMENDED','REPEALED','NOT_YET_IN_FORCE','STALE_UNVERIFIED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocRelationType" AS ENUM ('REPLACES','REPEALS','AMENDS','IMPLEMENTS','CITES'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SystemCompleteness" AS ENUM ('COMPLETE','MISSING_INSTRUMENT','MISSING_PREAMBLE','IN_PROGRESS'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── AlterTable: عمود اكتمال النظام (إضافيّ بقيمة افتراضية) ──
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "completeness" "SystemCompleteness" NOT NULL DEFAULT 'IN_PROGRESS';

-- ── legal_documents ──
CREATE TABLE IF NOT EXISTS "legal_documents" (
  "id" TEXT PRIMARY KEY,
  "system_id" TEXT NOT NULL REFERENCES "legal_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "doc_type" "DocumentType" NOT NULL,
  "number" TEXT,
  "hijri_date" TEXT,
  "gregorian_date" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "source_guid" TEXT,
  "source_url" TEXT,
  "raw_text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "legal_documents_source_guid_key" ON "legal_documents" ("source_guid");
CREATE INDEX IF NOT EXISTS "legal_documents_system_id_idx" ON "legal_documents" ("system_id");
CREATE INDEX IF NOT EXISTS "legal_documents_doc_type_idx" ON "legal_documents" ("doc_type");

-- ── document_units ──
CREATE TABLE IF NOT EXISTS "document_units" (
  "id" TEXT PRIMARY KEY,
  "system_id" TEXT NOT NULL REFERENCES "legal_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "document_id" TEXT NOT NULL REFERENCES "legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "parent_id" TEXT REFERENCES "document_units"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "unit_type" "DocUnitType" NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "label_ar" TEXT,
  "number" TEXT,
  "text_raw" TEXT NOT NULL,
  "text_normalized" TEXT,
  "path" TEXT NOT NULL,
  "char_start" INTEGER,
  "char_end" INTEGER,
  "status" "DocUnitStatus" NOT NULL DEFAULT 'IN_FORCE',
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "source_guid" TEXT,
  "source_url" TEXT,
  "article_id" TEXT REFERENCES "legal_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "document_units_system_id_idx" ON "document_units" ("system_id");
CREATE INDEX IF NOT EXISTS "document_units_document_id_ordinal_idx" ON "document_units" ("document_id","ordinal");
CREATE INDEX IF NOT EXISTS "document_units_parent_id_idx" ON "document_units" ("parent_id");
CREATE INDEX IF NOT EXISTS "document_units_unit_type_idx" ON "document_units" ("unit_type");
CREATE INDEX IF NOT EXISTS "document_units_status_idx" ON "document_units" ("status");
CREATE INDEX IF NOT EXISTS "document_units_article_id_idx" ON "document_units" ("article_id");

-- ── document_relations ──
CREATE TABLE IF NOT EXISTS "document_relations" (
  "id" TEXT PRIMARY KEY,
  "relation_type" "DocRelationType" NOT NULL,
  "source_unit_id" TEXT NOT NULL REFERENCES "document_units"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "target_unit_id" TEXT REFERENCES "document_units"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "target_ref" TEXT,
  "target_path" TEXT,
  "evidence_quote" TEXT NOT NULL,
  "source_guid" TEXT,
  "review_status" TEXT NOT NULL DEFAULT 'needs_review',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "document_relations_relation_type_idx" ON "document_relations" ("relation_type");
CREATE INDEX IF NOT EXISTS "document_relations_source_unit_id_idx" ON "document_relations" ("source_unit_id");
CREATE INDEX IF NOT EXISTS "document_relations_target_unit_id_idx" ON "document_relations" ("target_unit_id");

-- ── ingest_runs ──
CREATE TABLE IF NOT EXISTS "ingest_runs" (
  "id" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL,
  "run_type" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "captured" INTEGER NOT NULL DEFAULT 0,
  "classified" INTEGER NOT NULL DEFAULT 0,
  "inserted" INTEGER NOT NULL DEFAULT 0,
  "flagged" INTEGER NOT NULL DEFAULT 0,
  "raised" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "metadata" JSONB
);
CREATE INDEX IF NOT EXISTS "ingest_runs_source_idx" ON "ingest_runs" ("source");
CREATE INDEX IF NOT EXISTS "ingest_runs_run_type_idx" ON "ingest_runs" ("run_type");
