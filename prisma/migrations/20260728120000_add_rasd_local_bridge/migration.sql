-- Hakeem Rasd Local Bridge tables (additive).
-- Staging/control-plane only; does not mutate legal_* library content.

CREATE TABLE IF NOT EXISTS "rasd_agents" (
  "id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "public_key_pem" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "capabilities" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PAIRING',
  "last_seen_at" TIMESTAMP(3),
  "last_egress_country" TEXT,
  "egress_verified_at" TIMESTAMP(3),
  "egress_verification_method" TEXT,
  "approved_sources" JSONB NOT NULL,
  "boe_health" TEXT,
  "ncar_health" TEXT,
  "uqn_health" TEXT,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "paused_at" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "rasd_agents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rasd_agents_owner_id_idx" ON "rasd_agents"("owner_id");
CREATE INDEX IF NOT EXISTS "rasd_agents_status_idx" ON "rasd_agents"("status");

CREATE TABLE IF NOT EXISTS "rasd_pairing_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "agent_id" TEXT,
  CONSTRAINT "rasd_pairing_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rasd_pairing_codes_code_key" ON "rasd_pairing_codes"("code");
CREATE INDEX IF NOT EXISTS "rasd_pairing_codes_owner_id_idx" ON "rasd_pairing_codes"("owner_id");

CREATE TABLE IF NOT EXISTS "rasd_agent_jobs" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source_codes" JSONB NOT NULL,
  "parameters" JSONB,
  "dry_run" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 3,
  "result_summary" JSONB,
  "error_code" TEXT,
  "signature" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "cancel_requested" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "rasd_agent_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "rasd_agent_jobs_agent_status_idx" ON "rasd_agent_jobs"("agent_id", "status");
CREATE INDEX IF NOT EXISTS "rasd_agent_jobs_expires_at_idx" ON "rasd_agent_jobs"("expires_at");

CREATE TABLE IF NOT EXISTS "rasd_agent_result_chunks" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "chunk_index" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "payload_b64" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rasd_agent_result_chunks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "rasd_agent_result_chunks_job_idx" ON "rasd_agent_result_chunks"("job_id", "chunk_index");
