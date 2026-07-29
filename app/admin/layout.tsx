import { ClerkRoot } from "@/components/providers/ClerkRoot";
import { requireUser } from "@/lib/modules/auth/session";
import { redirect } from "next/navigation";
import { canUser } from "@/lib/modules/auth/rbac";
import { isPlatformAdmin } from "@/lib/modules/auth/super-admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (isPlatformAdmin(user)) {
    return <ClerkRoot>{children}</ClerkRoot>;
  }
  const [reports, usersManage] = await Promise.all([
    canUser(user.id, "ADMIN_REPORTS_VIEW"),
    canUser(user.id, "USERS_MANAGE"),
  ]);
  if (!reports && !usersManage) redirect("/dashboard");

  return <ClerkRoot>{children}</ClerkRoot>;
}
