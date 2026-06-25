-- المرحلة ٦: النسخ الزمنية للمادة (article_versions).
-- إضافة جدول جديد فقط — لا حذف، آمن لإعادة التشغيل (idempotent).
-- Rollback: DROP TABLE IF EXISTS "article_versions";
CREATE TABLE IF NOT EXISTS "article_versions" (
  "id"             TEXT NOT NULL,
  "article_id"     TEXT NOT NULL,
  "version_text"   TEXT NOT NULL,
  "effective_from" TIMESTAMP(3),
  "effective_to"   TIMESTAMP(3),
  "royal_decree"   TEXT,
  "hijri_date"     TEXT,
  "superseded_by"  TEXT,
  "source"         TEXT NOT NULL DEFAULT 'derived',
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "article_versions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "article_versions_article_id_effective_from_idx"
  ON "article_versions"("article_id", "effective_from");
CREATE INDEX IF NOT EXISTS "article_versions_effective_to_idx"
  ON "article_versions"("effective_to");

-- مفاتيح أجنبية idempotent (PostgreSQL لا يدعم ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_versions_article_id_fkey') THEN
    ALTER TABLE "article_versions"
      ADD CONSTRAINT "article_versions_article_id_fkey"
      FOREIGN KEY ("article_id") REFERENCES "legal_articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_versions_superseded_by_fkey') THEN
    ALTER TABLE "article_versions"
      ADD CONSTRAINT "article_versions_superseded_by_fkey"
      FOREIGN KEY ("superseded_by") REFERENCES "article_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
