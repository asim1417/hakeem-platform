-- ═══════════════════════════════════════════════════════════════════════════
-- [إصلاح SEARCH-PERF] نقل فهارس الأداء إلى مهاجرة رسميّة متتبَّعة (كانت سكربتات
-- يدويّة فقط، فلا يطبّقها deploy القياسي). idempotent، لا يحذف بيانات.
-- ⚠️ تُطبَّق عبر workflow مُقفَل على Neon (لا تُشغَّل تلقائيًا عند النشر).
--   - فهرس HNSW على المتجهات: يسرّع البحث الدلالي (ANN) بدل المسح التسلسلي.
--   - search_norm + GIN: مطابقة/ترتيب عربي مُطبَّع مفهرس (يُملأ عبر backfill-search-norm).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── فهرس ANN للمتجهات (بحث دلالي سريع) ──
-- يُبنى بعد تعبئة جدول embeddings (backfill-embeddings) ليكون على بيانات كاملة.
CREATE INDEX IF NOT EXISTS "idx_embeddings_hnsw_cosine"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);

-- ── عمود البحث العربي المُطبَّع + فهارسه (يُملأ عبر backfill-search-norm.ts) ──
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "search_norm" text;

CREATE INDEX IF NOT EXISTS "idx_legal_articles_search_norm_tsv"
  ON "legal_articles" USING gin (to_tsvector('simple', coalesce("search_norm", '')));

CREATE INDEX IF NOT EXISTS "idx_legal_articles_search_norm_trgm"
  ON "legal_articles" USING gin ("search_norm" gin_trgm_ops);
