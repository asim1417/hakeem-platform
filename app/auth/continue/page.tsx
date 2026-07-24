import { getCurrentUser } from "@/lib/modules/auth/session";
import { resolvePostLoginNext } from "@/lib/modules/auth/home-destination";
import { redirect } from "next/navigation";
import { AuthContinueClient } from "@/components/auth/AuthContinueClient";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * بعد OAuth (Google الأصلي أو Clerk):
 * 1) إن وُجدت معاملات handshake → Route Handler يثبت الكوكي (لا cookies().set من RSC)
 * 2) جلسة موجودة → وجهة حسب الدور
 * 3) وإلا انتظار محايد على العميل
 *
 * بدون مزوّد الجلسة على العميل في هذا المسار — يمنع انهيار iPhone → global-error.
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
  const nextSafe = safeDashboardNext(searchParams?.next, "/dashboard");
  const hasHandshake = Boolean(
    searchParams?.__clerk_handshake_nonce ||
      searchParams?.__clerk_handshake ||
      searchParams?.__clerk_db_jwt
  );

  if (hasHandshake) {
    const q = new URLSearchParams();
    q.set("next", nextSafe);
    if (searchParams?.__clerk_handshake_nonce) {
      q.set("__clerk_handshake_nonce", searchParams.__clerk_handshake_nonce);
    }
    if (searchParams?.__clerk_handshake) {
      q.set("__clerk_handshake", searchParams.__clerk_handshake);
    }
    if (searchParams?.__clerk_db_jwt) {
      q.set("__clerk_db_jwt", searchParams.__clerk_db_jwt);
    }
    redirect(`/api/auth/claim-clerk-return?${q.toString()}`);
  }

  const user = await getCurrentUser().catch(() => null);
  const next = resolvePostLoginNext(user, nextSafe);

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
