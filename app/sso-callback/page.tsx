import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export const metadata = {
  title: "إكمال الدخول — حكيم",
  robots: { index: false, follow: false },
};

/**
 * نقطة عودة OAuth من Google/Apple — Clerk يكمل الجلسة ثم يوجّه إلى redirectUrlComplete.
 */
export default function SsoCallbackPage() {
  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#F7F4EE] px-4"
      lang="ar"
      dir="rtl"
      aria-busy="true"
      aria-label="جارٍ إكمال تسجيل الدخول"
    >
      <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
          aria-hidden
        />
        <p className="mt-4 text-sm font-semibold text-[#0E3435]">جارٍ إكمال الدخول…</p>
        <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">لا تغلق هذه النافذة.</p>
        <div className="sr-only">
          <AuthenticateWithRedirectCallback />
        </div>
      </div>
    </main>
  );
}
