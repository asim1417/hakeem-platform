import { AppShell } from "@/components/AppShell";
import { AdminNav } from "@/components/admin/AdminNav";
import { getCurrentUser } from "@/lib/modules/auth/session";
import {
  isPlatformAdmin,
  isSuperAdmin,
  isSuperAdminPanelEnabled,
} from "@/lib/modules/auth/super-admin";

/**
 * غلاف موحّد لصفحات /admin — AppShell + تنقّل حسب الدور.
 * السوبر يرى القائمة الكاملة؛ مدير النظام يرى الروابط المسموحة فقط.
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

  return (
    <AppShell>
      {showSuper ? (
        <AdminNav currentPath={currentPath} variant="super" />
      ) : showSystem ? (
        <AdminNav currentPath={currentPath} variant="system" />
      ) : null}
      {children}
    </AppShell>
  );
}
