-- HKM-DOCUMENTS-UPGRADE-004 PR-2.5
-- Additive only: idempotency records for document import.
CREATE TABLE IF NOT EXISTS "api_idempotency_records" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseCode" INTEGER,
  "responseBody" JSONB,
  "entityId" TEXT,
  "status" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "api_idempotency_records_userId_scope_keyHash_key"
  ON "api_idempotency_records"("userId", "scope", "keyHash");

CREATE INDEX IF NOT EXISTS "api_idempotency_records_expiresAt_idx"
  ON "api_idempotency_records"("expiresAt");
