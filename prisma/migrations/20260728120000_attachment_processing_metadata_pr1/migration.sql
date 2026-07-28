-- HKM-DOCUMENTS-UPGRADE-002 PR-1
-- Additive / non-destructive: new enums + nullable/defaulted columns on attachments.
-- Does NOT rewrite existing extractedText rows (use scripts/migrate-attachment-metadata.ts).
-- Rollback: see docs/document-platform/pr1-rollback.md

-- ── Enums (idempotent) ──────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "AttachmentProcessingStatus" AS ENUM (
    'UPLOADED',
    'QUEUED',
    'DOWNLOADING',
    'SECURITY_SCAN',
    'EXTRACTING',
    'OCR',
    'QUALITY_CHECK',
    'READY',
    'PARTIAL',
    'FAILED',
    'QUARANTINED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttachmentSourceProvider" AS ENUM (
    'LOCAL_UPLOAD',
    'DIRECT_URL',
    'GOOGLE_DRIVE',
    'MICROSOFT_ONEDRIVE',
    'MICROSOFT_SHAREPOINT',
    'DROPBOX',
    'BOX'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Columns (idempotent ADD IF NOT EXISTS) ───────────────────────────────────
ALTER TABLE "attachments"
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "processingStatus" "AttachmentProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN IF NOT EXISTS "sourceProvider" "AttachmentSourceProvider" NOT NULL DEFAULT 'LOCAL_UPLOAD',
  ADD COLUMN IF NOT EXISTS "sourceExternalId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceConnectionId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceVersionId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceEtag" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUrlEncrypted" TEXT,
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "fileSize" BIGINT,
  ADD COLUMN IF NOT EXISTS "detectedMimeType" TEXT,
  ADD COLUMN IF NOT EXISTS "extractionEngine" TEXT,
  ADD COLUMN IF NOT EXISTS "extractionConfidence" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "extractionErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "extractionStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "extractionCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- لا إعادة كتابة extractedText ولا تحديثات بيانات ضخمة.
-- القيم الافتراضية تُطبَّق على الصفوف القائمة عبر DEFAULT عند إضافة العمود (PG 11+ بلا rewrite للثوابت).
