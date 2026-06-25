-- المرحلة ٣: معرّف ELI كنسي مبنيّ على slug ثابت.
-- إضافة عمود eli_slug إلى legal_systems (لا حذف، آمن لإعادة التشغيل).
-- يُملأ مرة واحدة عبر scripts/backfill-eli-slugs.ts ثم يُجمّد (لا يتغيّر بتغيّر الاسم).
-- Rollback:
--   DROP INDEX IF EXISTS "legal_systems_eli_slug_key";
--   ALTER TABLE "legal_systems" DROP COLUMN IF EXISTS "eli_slug";
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "eli_slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "legal_systems_eli_slug_key" ON "legal_systems"("eli_slug");
