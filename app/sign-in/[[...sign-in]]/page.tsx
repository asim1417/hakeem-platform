import Link from "next/link";
import {
  hasAnySignInProvider,
  listVisibleAuthProviders,
} from "@/lib/modules/auth/auth-providers";
import { AuthOauthButtons } from "@/components/auth/AuthOauthButtons";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

/** بوابة الدخول الموحّدة — /sign-in فقط (بلا Clerk JS على الصفحة). */
export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string };
}) {
  await hydrateEnvFromSettings().catch(() => 0);

  const ready = hasAnySignInProvider();
  const nextUrl = resolvePostAuthNext(searchParams);
  const visibleProviders = listVisibleAuthProviders();

  return (
    <AuthJourneyShell
      compact
      tagline="تابع أعمالك القانونية وتقاريرك وخدماتك الذكية من مكان واحد"
      footer={
        <nav className="login-panel__links" aria-label="روابط نظامية">
          <Link href="/">الرئيسية</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy">سياسة الخصوصية</Link>
          <span aria-hidden>·</span>
          <Link href="/terms">شروط الاستخدام</Link>
        </nav>
      }
    >
      {ready ? (
        <AuthOauthButtons
          mode="sign-in"
          nextUrl={nextUrl}
          visibleProviders={visibleProviders}
        />
      ) : (
        <div
          className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-4 py-5 text-center text-sm leading-7 text-[#0E3435]"
          role="status"
        >
          <p className="font-semibold">
            تعذّر تحميل بوابة الدخول. أعد المحاولة أو عد إلى الصفحة الرئيسية.
          </p>
          <p className="mt-2 text-[rgba(14,52,53,0.68)]">
            لا تتوفر وسيلة دخول مفعّلة حاليًا. يرجى التواصل مع مسؤول المنصة.
          </p>
          <p className="mt-4">
            <Link href="/" className="font-semibold text-[#8B6914]">
              العودة إلى الصفحة الرئيسية
            </Link>
          </p>
        </div>
      )}
    </AuthJourneyShell>
  );
}
