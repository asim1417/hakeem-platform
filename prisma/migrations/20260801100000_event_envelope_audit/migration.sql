-- مغلّف الحدث (المخطط السيادي §6/§23) — أعمدة اختيارية فوق سجلّ التدقيق.
-- إضافيّة بحتة: لا حذف، لا إعادة تسمية، لا تغيير سلوك. آمنة للتكرار.

ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "correlation_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "causation_id" TEXT;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "schema_version" TEXT;

CREATE INDEX IF NOT EXISTS "audit_logs_correlation_id_idx" ON "audit_logs" ("correlation_id");
