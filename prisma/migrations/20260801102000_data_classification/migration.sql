-- تصنيف البيانات الأمنيّ (المخطط السيادي §21) — إضافيّ، اختياريّ، لا حجب.
-- غياب القيمة (NULL) يُعامَل INTERNAL في طبقة التطبيق.

DO $$ BEGIN
  CREATE TYPE "DataClass" AS ENUM ('PUBLIC','INTERNAL','CONFIDENTIAL','RESTRICTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "cases"              ADD COLUMN IF NOT EXISTS "data_class" "DataClass";
ALTER TABLE "attachments"        ADD COLUMN IF NOT EXISTS "data_class" "DataClass";
ALTER TABLE "consultations"      ADD COLUMN IF NOT EXISTS "data_class" "DataClass";
ALTER TABLE "judicial_work_cases" ADD COLUMN IF NOT EXISTS "data_class" "DataClass";
