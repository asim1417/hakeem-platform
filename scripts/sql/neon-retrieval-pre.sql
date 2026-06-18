-- ════════════════════════════════════════════════════════════════════════
-- Neon Retrieval Upgrade — الجزء الأول (قبل التعبئة)
-- آمن للتكرار (IF NOT EXISTS). لا يحذف بيانات. يُطبَّق عبر workflow مُقفل فقط.
--
-- المكوّنات:
--   1) الامتدادات: pg_trgm (بحث نصّي تقريبي) + vector (تخزين المتجهات).
--   2) جدول embeddings (مطابق لنموذج Prisma `Embedding`) — مفقود على Neon.
--   3) فهارس GIN trigram لتسريع البحث النصّي العربي (ILIKE) على كل الصفوف.
--
-- ملاحظة: فهارس trigram مُدارة خارج Prisma (schema.prisma لم يُمسّ). تشغيل
-- `prisma db push` قد يحاول إسقاطها — لا تشغّله على Neon (مقفول أصلاً).
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- ── جدول المتجهات (pgvector) — يطابق نموذج Prisma Embedding ──
CREATE TABLE IF NOT EXISTS "embeddings" (
  "id"         TEXT NOT NULL,
  "owner_type" TEXT NOT NULL,
  "owner_id"   TEXT NOT NULL,
  "embedding"  vector(1536),
  "model"      TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "embeddings_owner_type_owner_id_key"
  ON "embeddings" ("owner_type", "owner_id");

-- ── فهارس GIN trigram للبحث النصّي السريع (substring/ILIKE) ──
CREATE INDEX IF NOT EXISTS "idx_legal_articles_content_trgm"
  ON "legal_articles" USING gin ("content" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_legal_articles_title_trgm"
  ON "legal_articles" USING gin ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_judicial_cases_text_trgm"
  ON "judicial_cases" USING gin ("judgmentText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_judicial_cases_title_trgm"
  ON "judicial_cases" USING gin ("judgmentTitle" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_judicial_principles_text_trgm"
  ON "judicial_principles" USING gin ("principleText" gin_trgm_ops);
