import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getProfile } from "@/lib/modules/onboarding/profile";
import { EssentialsPrompt } from "@/components/onboarding/EssentialsPrompt";

/** يعرض بطاقة الاسم/الجوال إن ناقصة ولم يُخفِها المستخدم. */
export async function EssentialsPromptGate() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.email === "guest@hakeem.local") return null;

  if (cookies().get("hakeem_essentials_dismissed")?.value === "1") return null;

  const profile = await getProfile(user.id);
  const hasPhone = Boolean(profile.phone?.trim());
  const hasName = Boolean(user.name?.trim()) && !user.name.includes("@");

  if (hasPhone && hasName) return null;

  return <EssentialsPrompt initialName={user.name} initialPhone={profile.phone} />;
}
