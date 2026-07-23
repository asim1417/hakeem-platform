import { AppShell } from "@/components/AppShell";
import { EssentialsPromptGate } from "@/components/onboarding/EssentialsPromptGate";
import { ClerkRoot } from "@/components/providers/ClerkRoot";
import { requireUser } from "@/lib/modules/auth/session";
import { getProfile, needsEssentials } from "@/lib/modules/onboarding/profile";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
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
