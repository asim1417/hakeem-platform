import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
import { AdminNavDisclosure } from "@/components/editorial/AdminNavDisclosure";
import { getCurrentUser } from "@/lib/modules/auth/session";
import {
  isPlatformAdmin,
  isSuperAdmin,
  isSuperAdminPanelEnabled,
} from "@/lib/modules/auth/super-admin";

/**
 * غلاف صفحات /admin:
 * - السوبر → غلاف إدارة مستقل (ليس واجهة عميل)
 * - مدير النظام → AppShell + تنقّل محدود
 * mobileNavSection (اختياري، لصفحات مكتب التحرير وحدها): يطوي قائمة الإدارة على الجوال تحت زر
 * «أقسام الإدارة · القسم». الافتراضي (بلا قيمة) لا يغيّر شيئًا في بقية صفحات الإدارة.
 */
export async function AdminPageShell({
  currentPath,
  mobileNavSection,
  children,
}: {
  currentPath: string;
  mobileNavSection?: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  const showSuper = Boolean(user && isSuperAdmin(user) && isSuperAdminPanelEnabled());
  const showSystem = Boolean(user && isPlatformAdmin(user));

  if (showSuper) {
    return (
      <SuperAdminShell currentPath={currentPath} user={user} mobileNavSection={mobileNavSection}>
        {children}
      </SuperAdminShell>
    );
  }

  return (
    <AppShell>
      {showSystem ? (
        mobileNavSection ? (
          <AdminNavDisclosure section={mobileNavSection}>
            <AdminNav currentPath={currentPath} variant="system" />
          </AdminNavDisclosure>
        ) : (
          <AdminNav currentPath={currentPath} variant="system" />
        )
      ) : null}
      {children}
    </AppShell>
  );
}
