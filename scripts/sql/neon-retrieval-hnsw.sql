-- ════════════════════════════════════════════════════════════════════════
-- Neon Retrieval Upgrade — الجزء الثاني (بعد التعبئة)
-- يُنشئ فهرس HNSW على جدول embeddings للبحث الدلالي التقريبي السريع (ANN).
-- يُشغَّل بعد backfill-embeddings-table كي يُبنى الفهرس على بيانات كاملة (أسرع).
-- آمن للتكرار. لا يحذف بيانات.
-- ════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "idx_embeddings_hnsw_cosine"
  ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
