-- HKM-023-B: مخطط أساس مصغّر لاختبارات قاعدة محلية فقط (لا بيانات).
-- الأعمدة منقولة من مخطط الإنتاج (information_schema، قراءة 17/10/2026) للجداول التي تقرؤها دوال العرض.
-- جدول verification بقيود الإنتاج الحالية ومشغّل الإضافة فقط. لا pgvector (غير مثبت محليًا) ولا ما لا يلزم.
-- يُطبَّق ثم ترحيل prisma/migrations/20261017130000_hkm023b_preamble_units/migration.sql فوقه.

CREATE OR REPLACE FUNCTION hakeem_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table %', TG_TABLE_NAME;
END;
$$;

CREATE TABLE IF NOT EXISTS legal_systems (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
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

CREATE TABLE IF NOT EXISTS legal_articles (
  id text PRIMARY KEY,
  "legalSystemId" text REFERENCES legal_systems(id),
  "lawName" text NOT NULL,
  classification text,
  "articleNumber" integer NOT NULL,
  -- HKM-028 (20261017120000_article_bis، مطبَّق على الإنتاج): درجة «مكرر»؛ 100 فأعلى صف ليس مادة.
  "articleBis" integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  content text NOT NULL,
  chapter text,
  keywords text[] NOT NULL DEFAULT '{}',
  "royalDecree" text,
  "effectiveFrom" timestamp,
  status text NOT NULL DEFAULT 'سارية',
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  search_norm text,
  UNIQUE ("lawName", "articleNumber", "articleBis")
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  object_type text NOT NULL CHECK (object_type IN ('work', 'unit', 'effect', 'relation')),
  object_id text NOT NULL,
  verified_status text NOT NULL CHECK (verified_status IN ('ساري', 'صادر لم يسرِ بعد', 'ملغى', 'مستبدل', 'ملغى مع بقاء أحكام محددة مؤقتًا', 'إلغاء جزئي معلّق على شرط', 'ملغاة', 'مضافة', 'سجل مخلوط — لا يُعرض')),
  evidence_instrument text,
  evidence_url text,
  evidence_quote text,
  method text NOT NULL CHECK (method IN ('rule', 'manual', 'owner_decision')),
  verified_by text,
  verified_at timestamptz NOT NULL DEFAULT NOW(),
  supersedes_verification_id text
);
CREATE INDEX IF NOT EXISTS verification_object_idx ON verification (object_type, object_id, verified_at DESC);
CREATE OR REPLACE TRIGGER verification_append_only BEFORE UPDATE OR DELETE ON verification FOR EACH ROW EXECUTE FUNCTION hakeem_append_only();

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

CREATE TABLE IF NOT EXISTS search_surface (
  id text PRIMARY KEY,
  work_key text NOT NULL,
  surface_system_id text REFERENCES legal_systems(id),
  valid_on date NOT NULL,
  reason text NOT NULL,
  supersedes_surface_id text REFERENCES search_surface(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS search_surface_member (
  id text PRIMARY KEY,
  work_key text NOT NULL,
  system_id text NOT NULL REFERENCES legal_systems(id),
  role text NOT NULL CHECK (role IN ('mixed', 'edition_old', 'edition_new', 'retired', 'successor')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (work_key, system_id)
);

CREATE TABLE IF NOT EXISTS law_card (
  id text PRIMARY KEY,
  system_id text NOT NULL REFERENCES legal_systems(id),
  official_name text NOT NULL,
  summary text,
  issued_hijri text,
  issued_gregorian date,
  published_hijri text,
  published_gregorian date,
  status_at_source text,
  category_path text[] NOT NULL DEFAULT '{}',
  instruments jsonb NOT NULL DEFAULT '[]',
  text_blocks jsonb NOT NULL DEFAULT '[]',
  source_name text NOT NULL,
  source_url text NOT NULL,
  retrieved_on date NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legal_system_issuance (
  id text PRIMARY KEY,
  system_id text NOT NULL,
  code text,
  issue_date_hijri text,
  issue_date_greg date,
  instrument text,
  source_url text,
  verified_by text,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS embedding_version (
  id text PRIMARY KEY,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  model text NOT NULL,
  content_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
