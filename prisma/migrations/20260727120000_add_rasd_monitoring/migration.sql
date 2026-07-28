-- محرك رصد — طبقة مراقبة تشريعية staging-only.
-- هجرة إضافية وآمنة لإعادة التشغيل: لا تحذف ولا تعدّل محتوى جداول legal_*.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AuditSubject') THEN
    ALTER TYPE "AuditSubject" ADD VALUE IF NOT EXISTS 'RASD';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "monitoring_sources" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "base_domain" TEXT NOT NULL,
  "source_role" TEXT NOT NULL,
  "trust_priority" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "supports_api" BOOLEAN NOT NULL DEFAULT false,
  "supports_rss" BOOLEAN NOT NULL DEFAULT false,
  "supports_sitemap" BOOLEAN NOT NULL DEFAULT true,
  "crawl_policy" TEXT,
  "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 20,
  "last_successful_scan_at" TIMESTAMP(3),
  "last_failed_scan_at" TIMESTAMP(3),
  "health_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "parser_version" TEXT NOT NULL DEFAULT '1.0.0',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitoring_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "monitoring_runs" (
  "id" TEXT NOT NULL,
  "run_type" TEXT NOT NULL,
  "trigger_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "source_id" TEXT,
  "pages_discovered" INTEGER NOT NULL DEFAULT 0,
  "pages_fetched" INTEGER NOT NULL DEFAULT 0,
  "documents_discovered" INTEGER NOT NULL DEFAULT 0,
  "documents_new" INTEGER NOT NULL DEFAULT 0,
  "documents_changed" INTEGER NOT NULL DEFAULT 0,
  "documents_unchanged" INTEGER NOT NULL DEFAULT 0,
  "documents_failed" INTEGER NOT NULL DEFAULT 0,
  "conflicts_found" INTEGER NOT NULL DEFAULT 0,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "error_summary" TEXT,
  "checkpoint" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitoring_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_snapshots" (
  "id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "run_id" TEXT,
  "source_url" TEXT NOT NULL,
  "canonical_url" TEXT,
  "http_status" INTEGER,
  "content_type" TEXT,
  "etag" TEXT,
  "last_modified" TEXT,
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw_storage_path" TEXT,
  "raw_text" TEXT,
  "content_hash" TEXT NOT NULL,
  "parser_version" TEXT NOT NULL,
  "parse_status" TEXT NOT NULL DEFAULT 'PENDING',
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "monitored_legal_documents" (
  "id" TEXT NOT NULL,
  "normalized_title" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "issuing_authority" TEXT,
  "approval_instrument_type" TEXT,
  "approval_instrument_number" TEXT,
  "approval_date_hijri" TEXT,
  "approval_date_gregorian" TIMESTAMP(3),
  "publication_date_hijri" TEXT,
  "publication_date_gregorian" TIMESTAMP(3),
  "effective_date_hijri" TEXT,
  "effective_date_gregorian" TIMESTAMP(3),
  "umm_al_qura_issue_number" TEXT,
  "status" TEXT NOT NULL DEFAULT 'REQUIRES_REVIEW',
  "subject_category" TEXT,
  "canonical_identity_key" TEXT NOT NULL,
  "current_source_version_id" TEXT,
  "matched_legal_system_id" TEXT,
  "match_status" TEXT NOT NULL DEFAULT 'NO_MATCH',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitored_legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "monitored_document_versions" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "snapshot_id" TEXT,
  "source_document_id" TEXT,
  "source_title" TEXT NOT NULL,
  "source_url" TEXT NOT NULL,
  "version_hash" TEXT NOT NULL,
  "normalized_text_hash" TEXT NOT NULL,
  "structure_hash" TEXT NOT NULL,
  "metadata_hash" TEXT NOT NULL,
  "full_normalized_text" TEXT,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "valid_from" TIMESTAMP(3),
  "valid_to" TIMESTAMP(3),
  "is_current_at_source" BOOLEAN NOT NULL DEFAULT true,
  "is_official_publication_copy" BOOLEAN NOT NULL DEFAULT false,
  "parser_version" TEXT NOT NULL,
  "parse_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitored_document_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "monitored_provisions" (
  "id" TEXT NOT NULL,
  "document_version_id" TEXT NOT NULL,
  "provision_type" TEXT NOT NULL,
  "article_number_raw" TEXT,
  "article_number_normalized" TEXT,
  "paragraph_number" TEXT,
  "parent_provision_id" TEXT,
  "heading" TEXT,
  "text_raw" TEXT NOT NULL,
  "text_normalized" TEXT NOT NULL,
  "text_hash" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "page_number" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "monitored_provisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "legal_document_matches" (
  "id" TEXT NOT NULL,
  "monitored_document_id" TEXT NOT NULL,
  "legal_system_id" TEXT,
  "match_method" TEXT NOT NULL,
  "match_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "title_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "instrument_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "date_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "content_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'AMBIGUOUS',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_document_matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "legal_change_detections" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "source_version_id" TEXT,
  "hakeem_legal_system_id" TEXT,
  "change_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "old_value" TEXT,
  "new_value" TEXT,
  "diff_json" JSONB,
  "diff_html" TEXT,
  "evidence_snapshot_id" TEXT,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "review_status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "review_decision" TEXT,
  "review_notes" TEXT,
  "applied_at" TIMESTAMP(3),
  "applied_batch_id" TEXT,
  "rolled_back_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_change_detections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_conflicts" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "field_name" TEXT NOT NULL,
  "boe_value" TEXT,
  "ncar_value" TEXT,
  "uqn_value" TEXT,
  "conflict_type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolved_by" TEXT,
  "resolved_at" TIMESTAMP(3),
  "evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "legal_update_reviews" (
  "id" TEXT NOT NULL,
  "change_detection_id" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reviewer_id" TEXT,
  "reviewer_role" TEXT,
  "reason" TEXT,
  "approved_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_update_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "rasd_document_types" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rasd_document_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "rasd_run_locks" (
  "id" TEXT NOT NULL,
  "lock_key" TEXT NOT NULL,
  "run_id" TEXT,
  "holder" TEXT,
  "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rasd_run_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "monitoring_sources_code_key" ON "monitoring_sources"("code");
CREATE INDEX IF NOT EXISTS "monitoring_runs_status_started_at_idx" ON "monitoring_runs"("status", "started_at");
CREATE INDEX IF NOT EXISTS "monitoring_runs_run_type_created_at_idx" ON "monitoring_runs"("run_type", "created_at");
CREATE INDEX IF NOT EXISTS "source_snapshots_source_id_content_hash_idx" ON "source_snapshots"("source_id", "content_hash");
CREATE INDEX IF NOT EXISTS "source_snapshots_run_id_idx" ON "source_snapshots"("run_id");
CREATE INDEX IF NOT EXISTS "source_snapshots_fetched_at_idx" ON "source_snapshots"("fetched_at");
CREATE UNIQUE INDEX IF NOT EXISTS "monitored_legal_documents_canonical_identity_key_key" ON "monitored_legal_documents"("canonical_identity_key");
CREATE INDEX IF NOT EXISTS "monitored_legal_documents_normalized_title_idx" ON "monitored_legal_documents"("normalized_title");
CREATE INDEX IF NOT EXISTS "monitored_legal_documents_document_type_status_idx" ON "monitored_legal_documents"("document_type", "status");
CREATE INDEX IF NOT EXISTS "monitored_legal_documents_match_status_idx" ON "monitored_legal_documents"("match_status");
CREATE INDEX IF NOT EXISTS "monitored_document_versions_document_id_source_id_idx" ON "monitored_document_versions"("document_id", "source_id");
CREATE INDEX IF NOT EXISTS "monitored_document_versions_version_hash_idx" ON "monitored_document_versions"("version_hash");
CREATE INDEX IF NOT EXISTS "monitored_document_versions_normalized_text_hash_idx" ON "monitored_document_versions"("normalized_text_hash");
CREATE INDEX IF NOT EXISTS "monitored_provisions_document_version_id_sequence_idx" ON "monitored_provisions"("document_version_id", "sequence");
CREATE INDEX IF NOT EXISTS "monitored_provisions_article_number_normalized_idx" ON "monitored_provisions"("article_number_normalized");
CREATE INDEX IF NOT EXISTS "monitored_provisions_text_hash_idx" ON "monitored_provisions"("text_hash");
CREATE INDEX IF NOT EXISTS "legal_document_matches_monitored_document_id_idx" ON "legal_document_matches"("monitored_document_id");
CREATE INDEX IF NOT EXISTS "legal_document_matches_legal_system_id_idx" ON "legal_document_matches"("legal_system_id");
CREATE INDEX IF NOT EXISTS "legal_document_matches_status_idx" ON "legal_document_matches"("status");
CREATE INDEX IF NOT EXISTS "legal_change_detections_document_id_change_type_idx" ON "legal_change_detections"("document_id", "change_type");
CREATE INDEX IF NOT EXISTS "legal_change_detections_review_status_detected_at_idx" ON "legal_change_detections"("review_status", "detected_at");
CREATE INDEX IF NOT EXISTS "legal_change_detections_severity_idx" ON "legal_change_detections"("severity");
CREATE INDEX IF NOT EXISTS "source_conflicts_document_id_status_idx" ON "source_conflicts"("document_id", "status");
CREATE INDEX IF NOT EXISTS "legal_update_reviews_change_detection_id_idx" ON "legal_update_reviews"("change_detection_id");
CREATE UNIQUE INDEX IF NOT EXISTS "rasd_document_types_code_key" ON "rasd_document_types"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "rasd_run_locks_lock_key_key" ON "rasd_run_locks"("lock_key");

DO $$ BEGIN
  ALTER TABLE "monitoring_runs" ADD CONSTRAINT "monitoring_runs_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "monitoring_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "monitoring_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_snapshots" ADD CONSTRAINT "source_snapshots_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "monitoring_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "monitored_legal_documents" ADD CONSTRAINT "monitored_legal_documents_matched_legal_system_id_fkey"
    FOREIGN KEY ("matched_legal_system_id") REFERENCES "legal_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "monitored_document_versions" ADD CONSTRAINT "monitored_document_versions_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "monitored_legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "monitored_document_versions" ADD CONSTRAINT "monitored_document_versions_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "monitoring_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "monitored_document_versions" ADD CONSTRAINT "monitored_document_versions_snapshot_id_fkey"
    FOREIGN KEY ("snapshot_id") REFERENCES "source_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "monitored_provisions" ADD CONSTRAINT "monitored_provisions_document_version_id_fkey"
    FOREIGN KEY ("document_version_id") REFERENCES "monitored_document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "monitored_provisions" ADD CONSTRAINT "monitored_provisions_parent_provision_id_fkey"
    FOREIGN KEY ("parent_provision_id") REFERENCES "monitored_provisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_document_matches" ADD CONSTRAINT "legal_document_matches_monitored_document_id_fkey"
    FOREIGN KEY ("monitored_document_id") REFERENCES "monitored_legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_document_matches" ADD CONSTRAINT "legal_document_matches_legal_system_id_fkey"
    FOREIGN KEY ("legal_system_id") REFERENCES "legal_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_change_detections" ADD CONSTRAINT "legal_change_detections_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "monitored_legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "source_conflicts" ADD CONSTRAINT "source_conflicts_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "monitored_legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "legal_update_reviews" ADD CONSTRAINT "legal_update_reviews_change_detection_id_fkey"
    FOREIGN KEY ("change_detection_id") REFERENCES "legal_change_detections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
