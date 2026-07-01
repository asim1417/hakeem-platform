-- ════════════════════════════════════════════════════════════════════════
-- الترتيب داخل القاعدة — الأساس: عمود نصّ عربي مُطبَّع مسبقاً + فهرس GIN.
--
-- يعالج فجوتين: (1) التطبيع وقت الاستعلام ضدّ نصّ خام (فتُفوَّت صور الهمزة/التاء
-- المربوطة/الألف المقصورة في المصدر)؛ (2) الاعتماد على عدّة ILIKE بدل مطابقة مفهرسة.
--
-- `search_norm`: نصّ مُطبَّع (نفس normalizeArabicText) يجمع الاسم+العنوان+النص+الكلمات+التصنيف.
-- يُملأ عبر scripts/backfill-search-norm.ts (خارج Prisma — العمود غير مُعرَّف في schema.prisma).
--
-- آمن للتكرار (IF NOT EXISTS). لا يحذف بيانات. يُطبَّق عبر workflow مُقفل على Neon فقط.
-- ملاحظة: pg_trgm مُفعَّل مسبقاً (neon-retrieval-pre.sql)؛ نُبقي CREATE EXTENSION احتياطاً.
-- ════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "search_norm" text;

-- فهرس GIN على tsvector('simple') للنصّ المُطبَّع — للاسترجاع/الترتيب داخل القاعدة (ts_rank_cd).
CREATE INDEX IF NOT EXISTS "idx_legal_articles_search_norm_tsv"
  ON "legal_articles" USING gin (to_tsvector('simple', coalesce("search_norm", '')));

-- فهرس trigram على العمود المُطبَّع — لمطابقة ILIKE على النصّ المُطبَّع (احتياطي/عبارات جزئية).
CREATE INDEX IF NOT EXISTS "idx_legal_articles_search_norm_trgm"
  ON "legal_articles" USING gin ("search_norm" gin_trgm_ops);
