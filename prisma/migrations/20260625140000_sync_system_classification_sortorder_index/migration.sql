-- مزامنة المخطط مع Neon (المرحلة ١): فهرس sortOrder.
-- العمود sort_order أُنشئ سابقًا في 20260625120000_add_system_classification.
-- هنا نضيف فهرسه فقط — إضافة آمنة قابلة لإعادة التشغيل، لا حذف بيانات.
-- اسم الفهرس يطابق توليد Prisma التلقائي (اسم العمود في القاعدة = sort_order).
-- Rollback: DROP INDEX IF EXISTS "legal_systems_sort_order_idx";
CREATE INDEX IF NOT EXISTS "legal_systems_sort_order_idx" ON "legal_systems"("sort_order");
