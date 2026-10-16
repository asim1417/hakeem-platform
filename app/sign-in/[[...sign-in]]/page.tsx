import Link from "next/link";
import {
  hasAnySignInProvider,
  listVisibleAuthProviders,
} from "@/lib/modules/auth/auth-providers";
import { AuthOauthButtons } from "@/components/auth/AuthOauthButtons";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { SignInPagePanel } from "@/components/auth/SignInPagePanel";
import { buildHomeAuthConfig } from "@/lib/modules/auth/home-auth-config";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";
import { isHomeInlineAuthEnabled } from "@/lib/modules/config/home-inline-auth";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

/**
 * صفحة الدخول الوحيدة — ‎/sign-in‎ (و‎/sign-up‎ و‎/auth/identifier‎ و‎/login‎ و‎/register‎ تُحال إليها).
 * صندوق الرئيسية نفسه: Google، وتبويبا «رقم الجوال | البريد الإلكتروني»، والرمز، ثم «تم التحقق»
 * ← الصفحة الداخلية (‎next‎، وافتراضيًا ‎/dashboard‎). Clerk يُحمَّل عند أول تفاعل فقط.
 * مفتاح الطوارئ HOME_INLINE_AUTH_ENABLED=0 يعيد البوابة السابقة كما هي.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string; mode?: string };
}) {
  await hydrateEnvFromSettings().catch(() => 0);

  const ready = hasAnySignInProvider();
  const nextUrl = resolvePostAuthNext(searchParams);
  const visibleProviders = listVisibleAuthProviders();
  const mode = searchParams?.mode === "sign-up" ? "sign-up" : "sign-in";

  if (ready && isHomeInlineAuthEnabled()) {
    return (
      <main className="hk-signin" lang="ar" dir="rtl">
        <Link href="/" className="hk-signin__brand" aria-label="حكيم — الصفحة الرئيسية">
          <span className="hk-signin__mark" aria-hidden>
            ح
          </span>
          <span>حكيم</span>
        </Link>
        <SignInPagePanel config={buildHomeAuthConfig()} mode={mode} nextUrl={nextUrl} />
        <nav className="hk-signin__links" aria-label="روابط نظامية">
          <Link href="/">الرئيسية</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy">سياسة الخصوصية</Link>
          <span aria-hidden>·</span>
          <Link href="/terms">شروط الاستخدام</Link>
        </nav>
      </main>
    );
  }

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
          mode={mode}
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
