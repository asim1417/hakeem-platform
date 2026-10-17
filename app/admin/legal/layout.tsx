import { AdminPageShell } from "@/components/admin/AdminPageShell";
import "./desk.css";

/**
 * غلاف صفحات المكتب: رموز desk.css، وغلاف الإدارة نفسه مرة واحدة للصفحات الخمس (بطيّ قائمة الإدارة على الجوال).
 * لأن الغلاف هنا لا في كل صفحة، يظهر هيكل التحميل (loading.tsx) وخطأ الصفحة (error.tsx) داخله
 * فلا يختفي رأس الإدارة أثناء التنقل بين صفحات المكتب.
 */
export default function EditorialDeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPageShell currentPath="/admin/legal" mobileNavSection="مكتب التحرير">
      {children}
    </AdminPageShell>
  );
}
