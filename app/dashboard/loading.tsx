// حالة تحميل مُنطاقة لمحتوى لوحة التحكم — تظهر أثناء التنقّل بين صفحات /dashboard
// مع بقاء الشريط الجانبي (بخلاف app/loading.tsx الجذري). تعالج غياب حالة التحميل
// في الصفحات الخادمية للنماذج (تحليل/محاكاة/وكيل/RAG وغيرها).
export default function DashboardLoading() {
  return (
    <div dir="rtl" className="grid min-h-[50vh] place-items-center p-6" role="status" aria-label="جارٍ التحميل">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--gold-ghost)] border-t-[var(--gold)]" aria-hidden />
        <p className="text-sm text-[var(--ink-60)]">جارٍ المعالجة…</p>
      </div>
    </div>
  );
}
