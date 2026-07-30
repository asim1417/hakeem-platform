import type { Metadata } from "next";
import Link from "next/link";
import {
  hasAnySignInProvider,
  listVisibleAuthProviders,
} from "@/lib/modules/auth/auth-providers";
import { AuthOauthButtons } from "@/components/auth/AuthOauthButtons";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { loginErrorMessage } from "@/lib/modules/auth/login-error-message";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const metadata: Metadata = {
  title: "الدخول إلى حكيم",
  description: "ادخل إلى مساحة عمل حكيم وتابع سؤالك أو ملف قضيتك من حيث توقفت.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string; login_error?: string };
}) {
  await hydrateEnvFromSettings().catch(() => 0);

  const ready = hasAnySignInProvider();
  const nextUrl = resolvePostAuthNext(searchParams);
  const visibleProviders = listVisibleAuthProviders();
  const errorMessage = loginErrorMessage(searchParams?.login_error);

  return (
    <AuthJourneyShell
      compact
      tagline="تابع سؤالك أو ملف قضيتك من حيث توقفت."
      footer={
        <nav className="login-panel__links" aria-label="روابط مساندة">
          <Link href="/">الرئيسية</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy">الخصوصية</Link>
          <span aria-hidden>·</span>
          <Link href="/terms">الشروط</Link>
        </nav>
      }
    >
      {ready ? (
        <AuthOauthButtons
          mode="sign-in"
          nextUrl={nextUrl}
          visibleProviders={visibleProviders}
          errorMessage={errorMessage}
        />
      ) : (
        <div
          className="w-full max-w-[26rem] rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] px-5 py-6 text-center shadow-[var(--sh-sm)]"
          role="alert"
        >
          <p className="font-bold text-[var(--navy)]">الدخول غير متاح مؤقتًا</p>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
            تعذّر تحميل وسيلة الدخول المفعّلة. أعد المحاولة بعد قليل.
          </p>
          <Link href="/" className="focus-ring mt-4 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-3 text-sm font-semibold text-[var(--gold-dark)]">
            العودة إلى الرئيسية
          </Link>
        </div>
      )}
    </AuthJourneyShell>
  );
}
