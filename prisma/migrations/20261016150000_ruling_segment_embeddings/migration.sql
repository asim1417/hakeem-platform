-- متجهات أجزاء الأحكام (الأسباب والمنطوق) — إضافة فقط، لا تمسّ judicial_cases ولا جدول embeddings.
-- المتجه القائم لكل حكم بُني من أول ٨٬٠٠٠ حرف (الديباجة غالبًا)؛ هذه متجهات العلّة والنتيجة.
-- الإزاحات على النص الأصلي judicial_cases."judgmentText". متساوية القوة (idempotent).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "ruling_segment_embeddings" (
  "ruling_id"         TEXT        NOT NULL,
  "part"              TEXT        NOT NULL CHECK ("part" IN ('reasons','disposition')),
  "chunk"             INTEGER     NOT NULL DEFAULT 0,
  "start_char"        INTEGER     NOT NULL,
  "end_char"          INTEGER     NOT NULL,
  "content_hash"      TEXT        NOT NULL,
  "embedding"         vector(1536) NOT NULL,
  "model"             TEXT        NOT NULL,
  "extractor_version" TEXT        NOT NULL,
  "segment_version"   TEXT        NOT NULL,
  "review_status"     TEXT        NOT NULL DEFAULT 'needs_review',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("ruling_id","part","chunk")
);

CREATE INDEX IF NOT EXISTS "idx_ruling_segment_embeddings_hnsw"
  ON "ruling_segment_embeddings" USING hnsw ("embedding" vector_cosine_ops);
