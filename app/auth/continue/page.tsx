import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/modules/auth/session";
import { getProfile, needsOnboarding } from "@/lib/modules/onboarding/profile";

export const dynamic = "force-dynamic";

/**
 * نقطة توحيد بعد Clerk: إكمال الملف إن لزم، وإلا اللوحة (أو ?next=).
 * يتجاهل الإجبار إن وُجدت كعكة التخطّي.
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const user = await requireUser();
  const nextRaw = searchParams?.next;
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  const skip = cookies().get("hakeem_onboarding_skipped")?.value === "1";
  const profile = await getProfile(user.id);

  if (!skip && needsOnboarding(profile, user.email) && !next.startsWith("/onboarding")) {
    redirect("/onboarding");
  }

  redirect(next);
}
