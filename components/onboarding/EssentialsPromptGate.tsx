import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getProfile } from "@/lib/modules/onboarding/profile";
import { EssentialsPrompt } from "@/components/onboarding/EssentialsPrompt";

/** تنبيه بسيط إن نقص الاسم أو الجوال أو المهنة. */
export async function EssentialsPromptGate() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.email === "guest@hakeem.local") return null;

  if (cookies().get("hakeem_essentials_dismissed")?.value === "1") return null;

  const profile = await getProfile(user.id);
  const hasPhone = Boolean(profile.phone?.trim());
  const hasName = Boolean(user.name?.trim()) && !user.name.includes("@");
  const hasProfession = Boolean(profile.entityType?.trim());

  if (hasPhone && hasName && hasProfession) return null;

  return (
    <EssentialsPrompt
      initialName={user.name}
      initialPhone={profile.phone}
      initialProfession={profile.entityType}
    />
  );
}
