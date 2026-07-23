import { SsoCallbackClient } from "@/components/auth/SsoCallbackClient";

export const metadata = {
  title: "إكمال الدخول — حكيم",
  robots: { index: false, follow: false },
};

/**
 * نقطة عودة OAuth من Google/Apple — Clerk يكمل الجلسة ثم يوجّه إلى /auth/continue.
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
      <SsoCallbackClient />
    </main>
  );
}
