import { getCurrentUser } from "@/lib/modules/auth/session";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";
import { redirect } from "next/navigation";
import { AuthContinueClient } from "@/components/auth/AuthContinueClient";

export const dynamic = "force-dynamic";

/**
 * بعد Clerk/OAuth → وجهة آمنة.
 * إن وُجدت جلسة فورًا نُحوِّل؛ وإلا ننتظر قليلًا على العميل قبل رسالة الفشل.
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = safeDashboardNext(searchParams?.next);
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    redirect(next);
  }

  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#F7F4EE] px-4"
      lang="ar"
      dir="rtl"
    >
      <AuthContinueClient nextPath={next} />
    </main>
  );
}
