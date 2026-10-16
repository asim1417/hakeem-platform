-- DATA-001 (الخيار الثاني): نقل الديباجة إلى حقل مخصّص على مستوى النظام بدل «المادة صفر».
-- هذا الجزء إضافيّ وآمن (أعمدة اختيارية). قيد CHECK يُضاف بعد نقل البيانات وحذف صفوف الصفر
-- عبر سكربت الهجرة scripts/backfill/move-preambles-to-system.ts (بموافقة + نسخة احتياطية).
-- ⚠️ لا يُطبَّق على الإنتاج آليًّا.

ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "preamble" TEXT;
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "preamble_royal_decree" TEXT;
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "preamble_effective_from" TIMESTAMP(3);
ALTER TABLE "legal_systems" ADD COLUMN IF NOT EXISTS "preamble_updated_at" TIMESTAMP(3);
