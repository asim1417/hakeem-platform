-- جاهزية إطلاق قاعدة الأنظمة + توثيق مصدر كل وثيقة رسمية.
-- إضافة غير هدمية؛ القيم الافتراضية تمنع اعتبار أي نظام جاهز قبل التحقق.

DO $$ BEGIN
  CREATE TYPE "LegalSystemLaunchStatus" AS ENUM ('NOT_READY','REVIEW_REQUIRED','READY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentVerificationStatus" AS ENUM ('UNVERIFIED','SOURCE_MATCHED','CROSS_SOURCE_MATCHED','REVIEW_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "legal_systems"
  ADD COLUMN IF NOT EXISTS "launch_status" "LegalSystemLaunchStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN IF NOT EXISTS "launch_validated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "launch_issues" JSONB;

ALTER TABLE "legal_documents"
  ADD COLUMN IF NOT EXISTS "source_code" TEXT,
  ADD COLUMN IF NOT EXISTS "source_document_id" TEXT,
  ADD COLUMN IF NOT EXISTS "content_sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "verification_status" "DocumentVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "legal_documents_source_code_idx" ON "legal_documents" ("source_code");
CREATE INDEX IF NOT EXISTS "legal_documents_source_code_source_document_id_idx" ON "legal_documents" ("source_code","source_document_id");
CREATE INDEX IF NOT EXISTS "legal_documents_verification_status_idx" ON "legal_documents" ("verification_status");
CREATE INDEX IF NOT EXISTS "legal_systems_launch_status_idx" ON "legal_systems" ("launch_status");
