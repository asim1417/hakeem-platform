-- طبقة الأحكام البحثية — المرحلة الأولى: اللقطة البحثية والبيانات الأساسية.
-- إضافيّة وidempotent: جداول جديدة فقط، لا تعديل ولا حذف. judicial_cases لا يُمسّ.
-- ⚠️ تُطبَّق على فرع Neon البحثي أولًا (research-<التاريخ>)، ولا تُطبَّق على الإنتاج إلا بالقفل
--    CONFIRM_RUNTIME_DB_ALIGNMENT=NEON_RUNTIME_CONFIRMED وموافقة صريحة من المالك.

CREATE TABLE IF NOT EXISTS "research_snapshot_meta" (
  "id"            TEXT PRIMARY KEY,                 -- مثل research-2026-10-16
  "taken_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "neon_branch"   TEXT,
  "rulings_count" INTEGER NOT NULL,
  "content_hash"  TEXT NOT NULL,                    -- sha256 لبصمات الأحكام مرتبة بالمعرّف
  "note"          TEXT
);

CREATE TABLE IF NOT EXISTS "ruling_meta" (
  "case_id"           TEXT PRIMARY KEY REFERENCES "judicial_cases"("id") ON DELETE RESTRICT,
  "snapshot_id"       TEXT REFERENCES "research_snapshot_meta"("id"),
  "year_h"            INTEGER,
  "month_h"           INTEGER,
  "day_h"             INTEGER,
  "date_source"       TEXT,                         -- decision | case
  "decision_date_g"   DATE,
  "date_g_method"     TEXT,                         -- tabular (قد يختلف يومًا عن أم القرى)
  "court_type"        TEXT,                         -- عامة | تجارية | أحوال شخصية | عمالية | جزائية | استئناف | أخرى
  "court_name_norm"   TEXT,
  "city_norm"         TEXT,
  "appeal_court_norm" TEXT,
  "degree"            TEXT,                         -- ابتدائي | استئناف | عليا
  "has_appeal_text"   BOOLEAN NOT NULL DEFAULT false,
  "appeal_link_id"    TEXT REFERENCES "judicial_cases"("id"),
  "text_len"          INTEGER NOT NULL,
  "is_empty"          BOOLEAN NOT NULL,
  "content_hash"      TEXT NOT NULL,
  "extractor_version" TEXT NOT NULL,
  "review_status"     TEXT NOT NULL DEFAULT 'needs_review',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ruling_meta_year_h_range" CHECK ("year_h" IS NULL OR "year_h" BETWEEN 1300 AND 1500),
  CONSTRAINT "ruling_meta_month_h_range" CHECK ("month_h" IS NULL OR "month_h" BETWEEN 1 AND 12),
  CONSTRAINT "ruling_meta_day_h_range" CHECK ("day_h" IS NULL OR "day_h" BETWEEN 1 AND 30)
);

CREATE INDEX IF NOT EXISTS "ruling_meta_year_h_idx" ON "ruling_meta"("year_h");
CREATE INDEX IF NOT EXISTS "ruling_meta_court_type_idx" ON "ruling_meta"("court_type");
CREATE INDEX IF NOT EXISTS "ruling_meta_city_norm_idx" ON "ruling_meta"("city_norm");
CREATE INDEX IF NOT EXISTS "ruling_meta_degree_idx" ON "ruling_meta"("degree");
