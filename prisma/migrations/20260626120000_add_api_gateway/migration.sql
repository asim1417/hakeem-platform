-- بوابة API الخارجية: جدولا api_keys و api_request_windows (إضافة فقط، idempotent).
-- Rollback:
--   DROP TABLE IF EXISTS "api_request_windows";
--   DROP TABLE IF EXISTS "api_keys";
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "key_prefix"    TEXT NOT NULL,
  "key_hash"      TEXT NOT NULL,
  "scopes"        TEXT[] NOT NULL DEFAULT '{}',
  "rate_limit"    INTEGER NOT NULL DEFAULT 60,
  "active"        BOOLEAN NOT NULL DEFAULT true,
  "last_used_at"  TIMESTAMP(3),
  "expires_at"    TIMESTAMP(3),
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_prefix_key" ON "api_keys"("key_prefix");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX IF NOT EXISTS "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

CREATE TABLE IF NOT EXISTS "api_request_windows" (
  "id"           TEXT NOT NULL,
  "api_key_id"   TEXT NOT NULL,
  "window_start" INTEGER NOT NULL,
  "count"        INTEGER NOT NULL DEFAULT 0,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_request_windows_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_request_windows_api_key_id_window_start_key" ON "api_request_windows"("api_key_id", "window_start");
CREATE INDEX IF NOT EXISTS "api_request_windows_window_start_idx" ON "api_request_windows"("window_start");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_request_windows_api_key_id_fkey') THEN
    ALTER TABLE "api_request_windows"
      ADD CONSTRAINT "api_request_windows_api_key_id_fkey"
      FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
