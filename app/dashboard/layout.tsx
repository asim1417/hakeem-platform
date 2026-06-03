import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/modules/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <AppShell>{children}</AppShell>;
}
