-- المرحلة ١.ب: تفكيك المعيار (normative tagging) على legal_articles.
-- إضافة أعمدة اختيارية + فهرس مركّب للاستعلام المفهوميّ (modality/addressee) — لا حذف،
-- آمن لإعادة التشغيل (idempotent). فارغ = مادة غير مُوسَّمة بعد (تُملأ عبر scripts/tag-normative.ts).
-- Rollback:
--   DROP INDEX IF EXISTS "legal_articles_norm_modality_norm_addressee_idx";
--   ALTER TABLE "legal_articles"
--     DROP COLUMN IF EXISTS "norm_addressee",
--     DROP COLUMN IF EXISTS "norm_modality",
--     DROP COLUMN IF EXISTS "norm_condition",
--     DROP COLUMN IF EXISTS "norm_effect",
--     DROP COLUMN IF EXISTS "norm_source";
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_addressee" TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_modality"  TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_condition" TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_effect"    TEXT;
ALTER TABLE "legal_articles" ADD COLUMN IF NOT EXISTS "norm_source"    TEXT;

CREATE INDEX IF NOT EXISTS "legal_articles_norm_modality_norm_addressee_idx"
  ON "legal_articles"("norm_modality", "norm_addressee");
