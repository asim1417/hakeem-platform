import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EssentialsPromptGate } from "@/components/onboarding/EssentialsPromptGate";
import { ClerkRoot } from "@/components/providers/ClerkRoot";
import {
  getRequestPathname,
  getRequestSearch,
  isBareDashboardPath,
} from "@/lib/modules/auth/request-path";
import { requireUser } from "@/lib/modules/auth/session";
import {
  isSuperAdmin,
  isSuperAdminPanelEnabled,
} from "@/lib/modules/auth/super-admin";
import { getProfile, needsEssentials } from "@/lib/modules/onboarding/profile";

/**
 * غلاف لوحة العميل.
 * السوبر يُحوَّل من /dashboard إلى /admin هنا — قبل رسم محتوى الـ workbench —
 * ما لم يكن في نافذة المنصة (?platform=1).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  if (isSuperAdmin(user) && isSuperAdminPanelEnabled()) {
    const pathname = getRequestPathname();
    const search = getRequestSearch();
    // إن توفّر رأس المسار وكان المسار لوحة جذر بلا نافذة → تحويل فوري
    if (pathname && isBareDashboardPath(pathname, search)) {
      redirect("/admin");
    }
  }

  const profile = await getProfile(user.id);

  const body = needsEssentials(user, profile) ? (
    <AppShell>
      <EssentialsPromptGate mode="block" />
    </AppShell>
  ) : (
    <AppShell>{children}</AppShell>
  );

  return <ClerkRoot>{body}</ClerkRoot>;
}
