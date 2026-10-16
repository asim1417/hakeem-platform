-- البند 1.7: فهرس بحث مستقلّ للأحكام. إضافيّ وآمن (عمود + فهرس GIN).
-- ⚠️ يُجرَّب على Neon branch أولًا، ولا يُطبَّق على الإنتاج إلا بموافقة صريحة.
-- عمود search_norm يُملأ نصًّا **منقّى من PDPL ومطبَّعًا** عبر
-- scripts/backfill/build-rulings-search-norm.ts (لا تُخزَّن أرقام هوية في الفهرس).

ALTER TABLE "judicial_cases" ADD COLUMN IF NOT EXISTS "search_norm" text;

-- فهرس GIN على تعبير to_tsvector يطابق ما يستعمله مسار البحث (إعداد simple = كلمات كاملة).
CREATE INDEX IF NOT EXISTS "judicial_cases_search_norm_gin"
  ON "judicial_cases" USING gin (to_tsvector('simple', coalesce("search_norm", '')));
