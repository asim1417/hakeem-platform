-- إضافة حقول provenance ومراجعة إلى legal_articles (إضافية وآمنة — أعمدة اختيارية).
-- ⚠️ لا تُطبَّق على الإنتاج آليًّا. تُطبَّق على staging أو الإنتاج بموافقة بشرية صريحة.
-- كلّها IF NOT EXISTS لتكون قابلة لإعادة التشغيل (idempotent).

ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "source_url" TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "source_publisher" TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "source_published_at" TIMESTAMP(3);
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "source_fetched_at" TIMESTAMP(3);
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "content_sha256" TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "review_status" TEXT NOT NULL DEFAULT 'unverified';

CREATE INDEX IF NOT EXISTS "legal_articles_review_status_idx" ON "legal_articles" ("review_status");
CREATE INDEX IF NOT EXISTS "legal_articles_content_sha256_idx" ON "legal_articles" ("content_sha256");
