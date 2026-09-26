import Link from "next/link";
import {
  hasAnySignInProvider,
  listVisibleAuthProviders,
} from "@/lib/modules/auth/auth-providers";
import { AuthOauthButtons } from "@/components/auth/AuthOauthButtons";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { redirect } from "next/navigation";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";
import { isHomeInlineAuthEnabled } from "@/lib/modules/config/home-inline-auth";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const metadata = {
  title: "إنشاء حساب — حكيم",
};

/**
 * ‎/sign-up‎ ← صفحة الدخول الوحيدة ‎/sign-in?mode=sign-up‎ (الإحالة في الـ middleware، وهذه احتياطها).
 * مع مفتاح الطوارئ HOME_INLINE_AUTH_ENABLED=0 تعود بوابة التسجيل السابقة كما هي.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string; ref?: string };
}) {
  if (isHomeInlineAuthEnabled()) {
    redirect(`/sign-in?${new URLSearchParams({ mode: "sign-up", next: resolvePostAuthNext(searchParams) })}`);
  }
  await hydrateEnvFromSettings().catch(() => 0);

  const ready = hasAnySignInProvider();
  const nextUrl = resolvePostAuthNext(searchParams);
  const visibleProviders = listVisibleAuthProviders();

  return (
    <AuthJourneyShell
      compact
      tagline="أنشئ حسابك وابدأ تجربتك المجانية في دقائق"
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
          mode="sign-up"
          nextUrl={nextUrl}
          visibleProviders={visibleProviders}
        />
      ) : (
        <div
          className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-4 py-5 text-center text-sm leading-7 text-[#0E3435]"
          role="status"
        >
          <p className="font-semibold">إنشاء الحساب غير متاح مؤقتًا</p>
          <p className="mt-2 text-[rgba(14,52,53,0.68)]">
            تعذّر تحميل بوابة الدخول. أعد المحاولة أو عد إلى الصفحة الرئيسية.
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
