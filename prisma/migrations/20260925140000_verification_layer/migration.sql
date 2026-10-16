-- طبقة التحقق والنسخ (إضافة فقط).
-- لا UPDATE ولا DELETE ولا DROP على جدول أو سجل قائم.
-- لا تُطبَّق على الإنتاج إلا بعد موافقة صريحة. لا تعبئة في هذه الهجرة.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "instrument_kind" TEXT;

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "object_type" TEXT NOT NULL CHECK ("object_type" IN ('work', 'unit', 'effect', 'relation')),
  "object_id" TEXT NOT NULL,
  "verified_status" TEXT NOT NULL CHECK ("verified_status" IN (
    'ساري',
    'صادر لم يسرِ بعد',
    'ملغى',
    'مستبدل',
    'ملغى مع بقاء أحكام محددة مؤقتًا',
    'إلغاء جزئي معلّق على شرط',
    'ملغاة',
    'مضافة'
  )),
  "evidence_instrument" TEXT,
  "evidence_url" TEXT,
  "evidence_quote" TEXT,
  "method" TEXT NOT NULL CHECK ("method" IN ('rule', 'manual')),
  "verified_by" TEXT,
  "verified_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "supersedes_verification_id" TEXT
);

CREATE INDEX IF NOT EXISTS "verification_object_idx"
  ON "verification" ("object_type", "object_id", "verified_at" DESC);

CREATE TABLE IF NOT EXISTS "unit_version" (
  "id" TEXT PRIMARY KEY,
  "unit_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "valid_from" TIMESTAMPTZ NOT NULL,
  "evidence_instrument" TEXT,
  "evidence_url" TEXT,
  "evidence_quote" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "unit_version_unit_idx"
  ON "unit_version" ("unit_id", "valid_from");

CREATE TABLE IF NOT EXISTS "embedding_version" (
  "id" TEXT PRIMARY KEY,
  "owner_type" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "embedding" vector(1536),
  "model" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "embedding_version_owner_idx"
  ON "embedding_version" ("owner_type", "owner_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "subscription_activation" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL UNIQUE,
  "plan_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION hakeem_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS verification_append_only ON "verification";
CREATE TRIGGER verification_append_only
  BEFORE UPDATE OR DELETE ON "verification"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();

DROP TRIGGER IF EXISTS unit_version_append_only ON "unit_version";
CREATE TRIGGER unit_version_append_only
  BEFORE UPDATE OR DELETE ON "unit_version"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();

DROP TRIGGER IF EXISTS embedding_version_append_only ON "embedding_version";
CREATE TRIGGER embedding_version_append_only
  BEFORE UPDATE OR DELETE ON "embedding_version"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();

DROP TRIGGER IF EXISTS subscription_activation_append_only ON "subscription_activation";
CREATE TRIGGER subscription_activation_append_only
  BEFORE UPDATE OR DELETE ON "subscription_activation"
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();
