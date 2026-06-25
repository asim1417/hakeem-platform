-- تصنيف وترميز الأنظمة: حقول إضافية فقط على legal_systems (لا حذف، آمن لإعادة التشغيل).
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "domain" TEXT;
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "domain_title" TEXT;
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "legal_systems_code_key" ON "legal_systems"("code");
CREATE INDEX IF NOT EXISTS "legal_systems_domain_idx" ON "legal_systems"("domain");
