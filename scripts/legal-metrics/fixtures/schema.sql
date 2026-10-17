-- مخطط اختبار خدمة العدّ (HKM-023-A) على قاعدة محلية فقط، بلا بيانات.
-- الأعمدة منقولة من مخطط الإنتاج (قراءة information_schema على Neon في 17/10/2026، قراءة فقط).
-- الفرق الوحيد المقصود: legal_relations.relation وstatus نوعان مخصّصان في الإنتاج، ونص هنا (لا تقرؤهما الخدمة).

CREATE TABLE legal_systems (
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

CREATE TABLE legal_articles (
  id text PRIMARY KEY,
  "legalSystemId" text,
  "lawName" text NOT NULL,
  classification text,
  "articleNumber" integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  chapter text,
  keywords text[],
  "royalDecree" text,
  "effectiveFrom" timestamp,
  status text NOT NULL DEFAULT 'سارية',
  embedding jsonb,
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  search_norm text,
  norm_addressee text,
  norm_modality text,
  norm_condition text,
  norm_effect text,
  norm_source text
);

CREATE TABLE judicial_cases (
  id text PRIMARY KEY,
  "sourceId" integer,
  "sourcePageId" integer,
  "decisionNo" text,
  "caseNo" text,
  "courtOfAppeal" text,
  "cityOfAppeal" text,
  court text,
  "cityName" text,
  "decisionDateText" text,
  "caseDateText" text,
  "decisionDate" timestamp,
  "caseDate" timestamp,
  classification jsonb,
  "judgmentTitle" text,
  "judgmentText" text NOT NULL,
  "appealText" text,
  "sourceLink" text,
  source text NOT NULL DEFAULT 'ahkam_moj',
  "reviewStatus" text NOT NULL DEFAULT 'needs_review',
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  search_norm text
);

CREATE TABLE legal_article_case_links (
  id text PRIMARY KEY,
  "articleId" text NOT NULL,
  -- القيد كما في الإنتاج (legal_article_case_links_caseId_fkey)؛ يضمن أن caseId المميز حكم قائم.
  "caseId" text NOT NULL REFERENCES judicial_cases(id),
  "relationType" text NOT NULL,
  "citedText" text,
  excerpt text,
  explanation text,
  confidence double precision,
  "reviewStatus" text NOT NULL DEFAULT 'needs_review',
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX legal_article_case_links_caseId_idx ON legal_article_case_links ("caseId");

CREATE TABLE judicial_principles (
  id text PRIMARY KEY,
  title text NOT NULL,
  "principleText" text NOT NULL,
  "sourceCaseId" text NOT NULL,
  court text,
  topic text,
  confidence double precision,
  "reviewStatus" text NOT NULL DEFAULT 'needs_review',
  "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE legal_relations (
  id text PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  relation text NOT NULL,
  strength double precision NOT NULL DEFAULT 1,
  description text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status text NOT NULL DEFAULT 'auto',
  authority double precision,
  evidence_id text
);

CREATE TABLE annotations (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  case_id text,
  document_type text NOT NULL,
  document_id text NOT NULL,
  highlighted_text text,
  note text,
  color text NOT NULL DEFAULT '#FEF08A',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fiqh_sources (
  id text PRIMARY KEY,
  source_title text NOT NULL,
  author text,
  school text,
  era text,
  source_type text NOT NULL,
  edition text,
  publisher text,
  verification_status text NOT NULL,
  external_id text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fiqh_texts (
  id text PRIMARY KEY,
  source_id text NOT NULL,
  book text,
  chapter text,
  section text,
  text_original text NOT NULL,
  text_normalized text,
  topic text,
  legal_concept_id text,
  page_reference text,
  citation text,
  external_ref text,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fiqh_article_alignments (
  id text PRIMARY KEY,
  article_id text NOT NULL,
  fiqh_text_id text NOT NULL,
  alignment_type text NOT NULL,
  alignment_reason text,
  confidence_score double precision,
  review_status text NOT NULL,
  reviewed_by text,
  reviewed_at timestamp,
  deleted_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE verification (
  id text PRIMARY KEY,
  object_type text NOT NULL,
  object_id text NOT NULL,
  verified_status text NOT NULL,
  evidence_instrument text,
  evidence_url text,
  evidence_quote text,
  method text NOT NULL,
  verified_by text,
  verified_at timestamptz NOT NULL DEFAULT NOW(),
  supersedes_verification_id text
);

CREATE TABLE law_card (
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
  created_at timestamptz NOT NULL DEFAULT now()
);
