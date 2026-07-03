-- فهارس إضافية لتسريع فلاتر البحث على المواد النظامية.
-- CONCURRENTLY: بناء بلا قفل الجدول (آمن على قاعدة حيّة). لا يعمل داخل معاملة — يُشغَّل عبر psql -f.
-- idempotent عبر IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ① فلتر النظام (systemIds): buildSystemFilter يطابق legalSystemId بالمساواة — b-tree يخدمه.
--    الاسم مطابق لاصطلاح Prisma (@@index([legalSystemId])) لاتّساق السكيمة مع القاعدة.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "legal_articles_legalSystemId_idx"
  ON "legal_articles" ("legalSystemId");

-- ② فلتر التصنيف (categoryIds): buildCategoryFilter يستخدم classification ILIKE '%..%' — trigram GIN يخدمه.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_trgm_la_classification"
  ON "legal_articles" USING gin ("classification" gin_trgm_ops);
