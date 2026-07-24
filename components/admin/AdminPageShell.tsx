import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { SuperAdminShell } from "@/components/admin/SuperAdminShell";
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
 */
export async function AdminPageShell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const user = await getCurrentUser().catch(() => null);
  const showSuper = Boolean(user && isSuperAdmin(user) && isSuperAdminPanelEnabled());
  const showSystem = Boolean(user && isPlatformAdmin(user));

  if (showSuper) {
    return (
      <SuperAdminShell currentPath={currentPath} user={user}>
        {children}
      </SuperAdminShell>
    );
  }

  return (
    <AppShell>
      {showSystem ? <AdminNav currentPath={currentPath} variant="system" /> : null}
      {children}
    </AppShell>
  );
}
