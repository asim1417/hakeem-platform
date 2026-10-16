-- ربط موصل حكيم (MCP) بحسابات المستخدمين — إضافة فقط، لا تعدّل بيانات قائمة.
-- متساوية القوة (idempotent): آمنة لإعادة التشغيل. التراجع في آخر الملف (معلّق).

CREATE TABLE IF NOT EXISTS "mcp_grants" (
  "id"                    TEXT         NOT NULL,
  "user_id"               TEXT         NOT NULL,
  "client_id"             TEXT         NOT NULL,
  "client_name"           TEXT         NOT NULL,
  "redirect_uri"          TEXT         NOT NULL,
  "resource"              TEXT         NOT NULL,
  "scopes"                TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "refresh_token_hash"    TEXT,
  "previous_refresh_hash" TEXT,
  "refresh_rotated_at"    TIMESTAMP(3),
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at"          TIMESTAMP(3),
  "revoked_at"            TIMESTAMP(3),
  "revoked_reason"        TEXT,
  CONSTRAINT "mcp_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mcp_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_grants_refresh_token_hash_key" ON "mcp_grants"("refresh_token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "mcp_grants_previous_refresh_hash_key" ON "mcp_grants"("previous_refresh_hash");
CREATE INDEX IF NOT EXISTS "mcp_grants_user_id_idx" ON "mcp_grants"("user_id");
CREATE INDEX IF NOT EXISTS "mcp_grants_client_id_idx" ON "mcp_grants"("client_id");

CREATE TABLE IF NOT EXISTS "mcp_auth_codes" (
  "code_hash"      TEXT         NOT NULL,
  "user_id"        TEXT         NOT NULL,
  "client_id"      TEXT         NOT NULL,
  "client_name"    TEXT         NOT NULL,
  "redirect_uri"   TEXT         NOT NULL,
  "code_challenge" TEXT         NOT NULL,
  "resource"       TEXT         NOT NULL,
  "scopes"         TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expires_at"     TIMESTAMP(3) NOT NULL,
  "used_at"        TIMESTAMP(3),
  "grant_id"       TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mcp_auth_codes_pkey" PRIMARY KEY ("code_hash")
);
CREATE INDEX IF NOT EXISTS "mcp_auth_codes_user_id_idx" ON "mcp_auth_codes"("user_id");

CREATE TABLE IF NOT EXISTS "mcp_request_windows" (
  "key"          TEXT    NOT NULL,
  "window_start" INTEGER NOT NULL,
  "count"        INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "mcp_request_windows_pkey" PRIMARY KEY ("key", "window_start")
);

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "api_keys_user_id_idx" ON "api_keys"("user_id");

-- التراجع (Rollback) — لا يمسّ بيانات أخرى:
-- DROP TABLE IF EXISTS "mcp_request_windows";
-- DROP TABLE IF EXISTS "mcp_auth_codes";
-- DROP TABLE IF EXISTS "mcp_grants";
-- DROP INDEX IF EXISTS "api_keys_user_id_idx";
-- ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "user_id";
