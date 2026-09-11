-- فهرسة بحث الأحكام: عمود عربيّ مُطبَّع + فهارس GIN — نظير legal_articles.search_norm.
-- إضافيّة تمامًا وidempotent (IF NOT EXISTS): لا حذف ولا تعديل هدميّ. العمود يُملأ عبر
-- scripts/backfill-rulings-search-norm.ts، ويُقرأ بـ SQL خام (خارج نموذج Prisma) فلا يكسر
-- أيّ استعلام قائم قبل تعبئته. pg_trgm مُفعّل مسبقًا (هجرة فهارس المواد).

ALTER TABLE "judicial_cases" ADD COLUMN IF NOT EXISTS "search_norm" text;

CREATE INDEX IF NOT EXISTS "idx_judicial_cases_search_norm_tsv"
  ON "judicial_cases" USING gin (to_tsvector('simple', coalesce("search_norm", '')));

CREATE INDEX IF NOT EXISTS "idx_judicial_cases_search_norm_trgm"
  ON "judicial_cases" USING gin ("search_norm" gin_trgm_ops);
