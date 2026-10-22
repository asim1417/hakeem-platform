-- HKM-028: درجة «مكرر» للمادة (بموافقة المالك «نفذ كل الخطوات»، 17/10/2026).
-- المادة المُدرَجة بين مادتين تأخذ رقم سابقتها مع bis (كما في lib/legal-work/hkn-uri.ts: art_N_bis)،
-- لا رقمًا تسلسليًّا يزيح ما بعدها. إضافي: عمود بقيمة 0 لكل الصفوف القائمة.
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "articleBis" INTEGER NOT NULL DEFAULT 0;

-- قيد التفرّد يشمل درجة «مكرر»: يُنشأ الجديد أولًا ثم يُستبدل به القديم الأضيق.
CREATE UNIQUE INDEX IF NOT EXISTS "legal_articles_lawName_articleNumber_articleBis_key"
  ON "legal_articles" ("lawName", "articleNumber", "articleBis");
DROP INDEX IF EXISTS "legal_articles_lawName_articleNumber_key";
