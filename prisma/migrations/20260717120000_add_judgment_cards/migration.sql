-- طبقة استخراج بطاقات الأحكام (جداول مخرجات داخلية) — idempotent بالكامل.
-- المصدر (judicial_cases / legal_systems / legal_articles) لا يُمَسّ؛ FKs من جداولنا إليه فقط.
-- لا علاقات Prisma عكسية على جداول المصدر — القيود على مستوى القاعدة هنا.

-- ── judgment_cards ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "judgment_cards" (
  "id"                TEXT NOT NULL,
  "judgment_id"       TEXT NOT NULL,
  "card"              JSONB NOT NULL,
  "confidence"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "extractor_version" TEXT NOT NULL,
  "verifier_agreed"   BOOLEAN,
  "review_status"     TEXT NOT NULL DEFAULT 'auto',
  "calibration"       BOOLEAN NOT NULL DEFAULT false,
  "run_id"            TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "judgment_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "judgment_cards_judgment_id_key" ON "judgment_cards" ("judgment_id");
CREATE INDEX IF NOT EXISTS "judgment_cards_review_status_idx" ON "judgment_cards" ("review_status");
CREATE INDEX IF NOT EXISTS "judgment_cards_calibration_idx" ON "judgment_cards" ("calibration");
CREATE INDEX IF NOT EXISTS "judgment_cards_run_id_idx" ON "judgment_cards" ("run_id");

-- ── judgment_article_links ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "judgment_article_links" (
  "id"              TEXT NOT NULL,
  "judgment_id"     TEXT NOT NULL,
  "legal_system_id" TEXT,
  "article_number"  TEXT NOT NULL,
  "article_id"      TEXT,
  "context"         TEXT NOT NULL,
  "verified"        BOOLEAN NOT NULL DEFAULT false,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "judgment_article_links_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "judgment_article_links_judgment_id_idx" ON "judgment_article_links" ("judgment_id");
CREATE INDEX IF NOT EXISTS "judgment_article_links_sys_art_idx" ON "judgment_article_links" ("legal_system_id", "article_number");
CREATE INDEX IF NOT EXISTS "judgment_article_links_article_id_idx" ON "judgment_article_links" ("article_id");

-- ── extraction_runs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "extraction_runs" (
  "id"             TEXT NOT NULL,
  "started_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at"    TIMESTAMP(3),
  "processed"      INTEGER NOT NULL DEFAULT 0,
  "failed"         INTEGER NOT NULL DEFAULT 0,
  "avg_confidence" DOUBLE PRECISION,
  "notes"          TEXT,
  CONSTRAINT "extraction_runs_pkey" PRIMARY KEY ("id")
);

-- ── مفاتيح أجنبية إلى المصدر (idempotent عبر DO block) ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judgment_cards_judgment_id_fkey') THEN
    ALTER TABLE "judgment_cards"
      ADD CONSTRAINT "judgment_cards_judgment_id_fkey"
      FOREIGN KEY ("judgment_id") REFERENCES "judicial_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judgment_cards_run_id_fkey') THEN
    ALTER TABLE "judgment_cards"
      ADD CONSTRAINT "judgment_cards_run_id_fkey"
      FOREIGN KEY ("run_id") REFERENCES "extraction_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judgment_article_links_judgment_id_fkey') THEN
    ALTER TABLE "judgment_article_links"
      ADD CONSTRAINT "judgment_article_links_judgment_id_fkey"
      FOREIGN KEY ("judgment_id") REFERENCES "judicial_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judgment_article_links_legal_system_id_fkey') THEN
    ALTER TABLE "judgment_article_links"
      ADD CONSTRAINT "judgment_article_links_legal_system_id_fkey"
      FOREIGN KEY ("legal_system_id") REFERENCES "legal_systems"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'judgment_article_links_article_id_fkey') THEN
    ALTER TABLE "judgment_article_links"
      ADD CONSTRAINT "judgment_article_links_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "legal_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── الفهرس العكسي: عرض (نظام، مادة) → الأحكام التي طبّقتها + عددها ──────────
-- الوقود الأولي لأداة takhrij_hukm. يُعاد إنشاؤه دائمًا (تعريف فقط، بلا بيانات).
CREATE OR REPLACE VIEW "article_judgments" AS
SELECT
  l."legal_system_id"                         AS legal_system_id,
  l."article_number"                          AS article_number,
  l."article_id"                              AS article_id,
  COUNT(DISTINCT l."judgment_id")             AS judgment_count,
  ARRAY_AGG(DISTINCT l."judgment_id")         AS judgment_ids
FROM "judgment_article_links" l
GROUP BY l."legal_system_id", l."article_number", l."article_id";
