-- البيانات الأساسية للحكم (ruling_meta) وأجزاؤه (ruling_segments) — إضافة فقط ومتساوية القوة.
-- judicial_cases لا يُمسّ: لا مفتاح أجنبي إليه (ON DELETE RESTRICT كان سيمنع حذف حكم منه)،
-- والربط بالمعرّف وحده. مخطط ruling_meta مطابق لفرع البحث (20261016120000) عدا المفاتيح الأجنبية.

CREATE TABLE IF NOT EXISTS "research_snapshot_meta" (
  "id"            TEXT PRIMARY KEY,
  "taken_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "neon_branch"   TEXT,
  "rulings_count" INTEGER NOT NULL,
  "content_hash"  TEXT NOT NULL,
  "note"          TEXT
);

CREATE TABLE IF NOT EXISTS "ruling_meta" (
  "case_id"           TEXT PRIMARY KEY,
  "snapshot_id"       TEXT REFERENCES "research_snapshot_meta"("id"),
  "year_h"            INTEGER,
  "month_h"           INTEGER,
  "day_h"             INTEGER,
  "date_source"       TEXT,
  "decision_date_g"   DATE,
  "date_g_method"     TEXT,
  "court_type"        TEXT,
  "court_name_norm"   TEXT,
  "city_norm"         TEXT,
  "appeal_court_norm" TEXT,
  "degree"            TEXT,
  "has_appeal_text"   BOOLEAN NOT NULL DEFAULT false,
  "appeal_link_id"    TEXT,
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

-- أجزاء الحكم بالقواعد: الإزاحات على النص الأصلي judicial_cases."judgmentText".
-- part_norm: نص الجزء مطبَّعًا ومحجوبًا (مثل search_norm) للأسباب والمنطوق فقط — ليُرتَّب
-- البحث اللفظي بما ورد في علّة الحكم ونتيجته قبل ما ورد في ديباجته.
CREATE TABLE IF NOT EXISTS "ruling_segments" (
  "ruling_id"       TEXT        NOT NULL,
  "part"            TEXT        NOT NULL CHECK ("part" IN ('header','claims','defense','evidence','reasons','disposition','appeal','other')),
  "start_char"      INTEGER     NOT NULL,
  "end_char"        INTEGER     NOT NULL,
  "method"          TEXT        NOT NULL DEFAULT 'rule',
  "confidence"      REAL        NOT NULL,
  "part_norm"       TEXT,
  "content_hash"    TEXT        NOT NULL,
  "segment_version" TEXT        NOT NULL,
  "review_status"   TEXT        NOT NULL DEFAULT 'needs_review',
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("ruling_id","part")
);
CREATE INDEX IF NOT EXISTS "ruling_segments_part_norm_gin"
  ON "ruling_segments" USING GIN (to_tsvector('simple', coalesce("part_norm",'')));
