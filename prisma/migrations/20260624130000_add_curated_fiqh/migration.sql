-- الطبقة الفقهية المنضبطة (مساندة غير ملزمة) — جداول جديدة فقط، آمنة لإعادة التشغيل.
-- لا تعدّل ولا تحذف أي جدول قائم.

CREATE TABLE IF NOT EXISTS "fiqh_sources" (
    "id" TEXT NOT NULL,
    "source_title" TEXT NOT NULL,
    "author" TEXT,
    "school" TEXT,
    "era" TEXT,
    "source_type" TEXT NOT NULL DEFAULT 'book',
    "edition" TEXT,
    "publisher" TEXT,
    "verification_status" TEXT NOT NULL DEFAULT 'unverified',
    "external_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fiqh_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fiqh_sources_external_id_key" ON "fiqh_sources"("external_id");
CREATE INDEX IF NOT EXISTS "fiqh_sources_author_idx" ON "fiqh_sources"("author");

CREATE TABLE IF NOT EXISTS "fiqh_texts" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "book" TEXT,
    "chapter" TEXT,
    "section" TEXT,
    "text_original" TEXT NOT NULL,
    "text_normalized" TEXT,
    "topic" TEXT,
    "legal_concept_id" TEXT,
    "page_reference" TEXT,
    "citation" TEXT,
    "external_ref" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiqh_texts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "fiqh_texts_source_id_idx" ON "fiqh_texts"("source_id");
CREATE INDEX IF NOT EXISTS "fiqh_texts_topic_idx" ON "fiqh_texts"("topic");

CREATE TABLE IF NOT EXISTS "fiqh_article_alignments" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "fiqh_text_id" TEXT NOT NULL,
    "alignment_type" TEXT NOT NULL DEFAULT 'topical',
    "alignment_reason" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "review_status" TEXT NOT NULL DEFAULT 'needs_review',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fiqh_article_alignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fiqh_article_alignments_article_id_fiqh_text_id_key" ON "fiqh_article_alignments"("article_id", "fiqh_text_id");
CREATE INDEX IF NOT EXISTS "fiqh_article_alignments_article_id_idx" ON "fiqh_article_alignments"("article_id");
CREATE INDEX IF NOT EXISTS "fiqh_article_alignments_review_status_idx" ON "fiqh_article_alignments"("review_status");

DO $$ BEGIN
  ALTER TABLE "fiqh_texts" ADD CONSTRAINT "fiqh_texts_source_id_fkey"
    FOREIGN KEY ("source_id") REFERENCES "fiqh_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "fiqh_article_alignments" ADD CONSTRAINT "fiqh_article_alignments_fiqh_text_id_fkey"
    FOREIGN KEY ("fiqh_text_id") REFERENCES "fiqh_texts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
