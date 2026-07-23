import { getCurrentUser } from "@/lib/modules/auth/session";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";
import { redirect } from "next/navigation";
import { AuthContinueClient } from "@/components/auth/AuthContinueClient";
import { claimSessionFromClerkReturn } from "@/lib/modules/auth/claim-clerk-return";

export const dynamic = "force-dynamic";

/**
 * بعد OAuth:
 * 1) جلسة موجودة → لوحة التحكم
 * 2) معاملات Clerk handshake → تثبيت hakeem_session
 * 3) وإلا انتظار قصير على العميل
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: {
    next?: string;
    __clerk_handshake?: string;
    __clerk_handshake_nonce?: string;
    __clerk_db_jwt?: string;
  };
}) {
  const next = safeDashboardNext(searchParams?.next);

  let user = await getCurrentUser().catch(() => null);
  if (!user) {
    user = await claimSessionFromClerkReturn({
      handshakeNonce: searchParams?.__clerk_handshake_nonce,
      handshakeToken: searchParams?.__clerk_handshake,
    }).catch(() => null);
  }

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
