import { getCurrentUser } from "@/lib/modules/auth/session";
import { getProfile, needsEssentials } from "@/lib/modules/onboarding/profile";
import { EssentialsPrompt } from "@/components/onboarding/EssentialsPrompt";

/**
 * إن نقصت البيانات الثلاثة: يعرض البوابة الإلزامية فقط (يحجب محتوى اللوحة).
 * إن اكتملت: يعيد null ويُعرض المحتوى كالمعتاد.
 */
export async function EssentialsPromptGate({
  mode = "banner",
}: {
  mode?: "banner" | "block";
}) {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.email === "guest@hakeem.local") return null;

  const profile = await getProfile(user.id);
  if (!needsEssentials(user, profile)) return null;

  const form = (
    <EssentialsPrompt
      initialName={user.name}
      initialPhone={profile.phone}
      initialProfession={profile.entityType}
    />
  );

  if (mode === "block") return form;
  return form;
}
