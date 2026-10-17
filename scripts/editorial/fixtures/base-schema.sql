-- مخطط أساس مصغّر لاختبارات مكتب التحرير على قاعدة محلية فقط.
-- الأعمدة منقولة من مخطط الإنتاج (قراءة information_schema في 17/10/2026)، ولا تحوي بيانات.
-- يُطبَّق قبل: ingest/uqn-2026-09-25/schema/staging.sql، ingest/uqn-fix-2026-09-25/schema/fix_stage.sql، ثم ترحيل المكتب.

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'LAWYER', 'TRAINER', 'TRAINEE', 'SUPER_ADMIN', 'JUDGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  "passwordHash" text NOT NULL DEFAULT '',
  role "UserRole" NOT NULL DEFAULT 'TRAINEE',
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isActive" boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS legal_systems (
  id text PRIMARY KEY,
  name text NOT NULL,
  classification text,
  "articleCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  code text,
  domain text,
  domain_title text,
  sort_order integer NOT NULL DEFAULT 0,
  eli_slug text,
  preamble text,
  preamble_royal_decree text,
  preamble_effective_from timestamp,
  preamble_updated_at timestamp,
  instrument_kind text
);

CREATE TABLE IF NOT EXISTS judicial_cases (
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS judicial_principles (
  id text PRIMARY KEY,
  title text NOT NULL,
  "principleText" text NOT NULL,
  "sourceCaseId" text NOT NULL REFERENCES judicial_cases(id),
  court text,
  topic text,
  confidence double precision,
  "reviewStatus" text NOT NULL DEFAULT 'needs_review',
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS legal_article_case_links (
  id text PRIMARY KEY,
  "articleId" text NOT NULL,
  "caseId" text NOT NULL,
  "relationType" text NOT NULL,
  "reviewStatus" text NOT NULL DEFAULT 'needs_review'
);

-- طبقة التحقق كما في الإنتاج (قيود الإنتاج الحالية، وهي أوسع من ملف ترحيلها الأصلي).
CREATE OR REPLACE FUNCTION hakeem_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME; END; $$;

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  object_type text NOT NULL CHECK (object_type IN ('work', 'unit', 'effect', 'relation')),
  object_id text NOT NULL,
  verified_status text NOT NULL CHECK (verified_status IN ('ساري', 'صادر لم يسرِ بعد', 'ملغى', 'مستبدل',
    'ملغى مع بقاء أحكام محددة مؤقتًا', 'إلغاء جزئي معلّق على شرط', 'ملغاة', 'مضافة', 'سجل مخلوط — لا يُعرض')),
  evidence_instrument text,
  evidence_url text,
  evidence_quote text,
  method text NOT NULL CHECK (method IN ('rule', 'manual', 'owner_decision')),
  verified_by text,
  verified_at timestamptz NOT NULL DEFAULT NOW(),
  supersedes_verification_id text
);
CREATE INDEX IF NOT EXISTS verification_object_idx ON verification (object_type, object_id, verified_at DESC);
DROP TRIGGER IF EXISTS verification_append_only ON verification;
CREATE TRIGGER verification_append_only BEFORE UPDATE OR DELETE ON verification
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();

CREATE TABLE IF NOT EXISTS unit_version (
  id text PRIMARY KEY,
  unit_id text NOT NULL,
  body text NOT NULL,
  valid_from timestamptz NOT NULL,
  evidence_instrument text,
  evidence_url text,
  evidence_quote text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS unit_version_append_only ON unit_version;
CREATE TRIGGER unit_version_append_only BEFORE UPDATE OR DELETE ON unit_version
  FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();

CREATE TABLE IF NOT EXISTS legal_articles (
  id text PRIMARY KEY,
  "legalSystemId" text NOT NULL REFERENCES legal_systems(id),
  "articleNumber" text NOT NULL,
  content text NOT NULL,
  status text
);
