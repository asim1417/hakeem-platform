import { AppShell } from "@/components/AppShell";
import { EssentialsPromptGate } from "@/components/onboarding/EssentialsPromptGate";
import { requireUser } from "@/lib/modules/auth/session";
import { getProfile, needsEssentials } from "@/lib/modules/onboarding/profile";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getProfile(user.id);

  if (needsEssentials(user, profile)) {
    return (
      <AppShell>
        <EssentialsPromptGate mode="block" />
      </AppShell>
    );
  }

  return <AppShell>{children}</AppShell>;
}
