import { getCurrentUser } from "@/lib/modules/auth/session";
import { resolvePostLoginNext } from "@/lib/modules/auth/home-destination";
import { redirect } from "next/navigation";
import { AuthContinueClient } from "@/components/auth/AuthContinueClient";
import { claimSessionFromClerkReturn } from "@/lib/modules/auth/claim-clerk-return";

export const dynamic = "force-dynamic";

/**
 * بعد OAuth:
 * 1) جلسة موجودة → وجهة حسب الدور (سوبر → /admin)
 * 2) معاملات Clerk handshake / db_jwt → تثبيت hakeem_session
 * 3) وإلا انتظار محايد على العميل (بلا فشل كاذب)
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
  const hasHandshake = Boolean(
    searchParams?.__clerk_handshake_nonce ||
      searchParams?.__clerk_handshake ||
      searchParams?.__clerk_db_jwt
  );

  let user = null as Awaited<ReturnType<typeof getCurrentUser>>;

  // إن وُجدت معاملات عودة Clerk — حاول المطالبة قبل قراءة الجلسة العادية
  if (hasHandshake) {
    user = await claimSessionFromClerkReturn({
      handshakeNonce: searchParams?.__clerk_handshake_nonce,
      handshakeToken: searchParams?.__clerk_handshake,
      sessionJwt: searchParams?.__clerk_db_jwt,
    }).catch(() => null);
  }
  if (!user) {
    user = await getCurrentUser().catch(() => null);
  }
  if (!user && !hasHandshake) {
    user = await claimSessionFromClerkReturn({
      handshakeNonce: searchParams?.__clerk_handshake_nonce,
      handshakeToken: searchParams?.__clerk_handshake,
      sessionJwt: searchParams?.__clerk_db_jwt,
    }).catch(() => null);
  }

  const next = resolvePostLoginNext(user, searchParams?.next);

  if (user) {
    redirect(next);
  }

  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#F7F4EE] px-4"
      lang="ar"
      dir="rtl"
      aria-busy="true"
      aria-label="جارٍ إكمال تسجيل الدخول"
    >
      <AuthContinueClient nextPath={next} />
    </main>
  );
}
