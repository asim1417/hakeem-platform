/**
 * حالة تحميل جذرية صامتة — نفس خلفية الصفحة دون نص «جارٍ التحميل»
 * حتى لا يومض المحتوى التسويقي أثناء force-dynamic / البث الأولي.
 */
export default function Loading() {
  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] bg-[var(--hakeem-bg,#EFF3F2)]"
      aria-busy="true"
      aria-label="جارٍ التحميل"
    />
  );
}
