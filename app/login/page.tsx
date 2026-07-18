import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { LegalAlert } from "@/components/ui/legal";
import { isAuthDisabled } from "@/lib/modules/auth/session";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";
import { safeNextPath } from "@/lib/modules/auth/oauth-shared";

const OAUTH_ERRORS: Record<string, string> = {
  google_disabled: "دخول Google غير مُفعّل بعد على الخادم.",
  google_denied: "أُلغيت المصادقة من Google.",
  google_profile: "تعذّر جلب بريد الحساب من Google أو أنه غير مُوثّق.",
  microsoft_disabled: "بوابة الدخول (Microsoft Entra) غير مُفعّلة بعد على الخادم.",
  microsoft_denied: "أُلغيت المصادقة من بوابة Microsoft.",
  microsoft_profile: "تعذّر جلب بريد الحساب من Microsoft أو أنه غير متاح.",
  oauth_state: "انتهت صلاحية جلسة الدخول أو تعذّر التحقق — أعد المحاولة.",
  oauth_user: "تعذّر تجهيز حساب المستخدم — حاول مرة أخرى.",
};

export const metadata = {
  title: "تسجيل الدخول — حكيم",
  description: "ادخل إلى منصة حكيم عبر بوابة Microsoft أو Google أو البريد الإلكتروني.",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const nextUrl = safeNextPath(searchParams?.next);
  // صفحة الدخول منشورة دائمًا — لا تُخفى حتى في وضع التطوير.
  const authDisabled = isAuthDisabled();

  const oauthError = searchParams?.error ? OAUTH_ERRORS[searchParams.error] ?? "تعذّر إكمال تسجيل الدخول." : null;
  const googleEnabled = isGoogleOAuthConfigured();
  const microsoftEnabled = isMicrosoftOAuthConfigured();

  return (
    <main className="login-page">
      <div aria-hidden className="login-page__glow" />
      <div aria-hidden className="login-page__pattern" />

      <div className="login-page__grid">
        <aside className="login-brand">
          <div className="login-brand__inner">
            <p className="login-brand__mark" aria-hidden>
              ح
            </p>
            <h1 className="login-brand__title">حكيم</h1>
            <p className="login-brand__tagline">رفيق المحامي في القاعة — تحليل الوقائع ومحاكاة القضاء.</p>
            <ul className="login-brand__points">
              <li>دخول موحّد عبر بوابة Microsoft Entra</li>
              <li>دخول سريع عبر Google</li>
              <li>اسم مستخدم وكلمة مرور من إعدادات المالك</li>
            </ul>
          </div>
        </aside>

        <section className="login-panel" aria-labelledby="login-heading">
          <div className="login-panel__card">
            <header className="login-panel__header">
              <p className="login-panel__eyebrow">منصة المعرفة القضائية</p>
              <h2 id="login-heading" className="login-panel__title">
                تسجيل الدخول
              </h2>
              <p className="login-panel__desc">
                سجّل الدخول باسم المستخدم أو البريد، أو عبر بوابة Microsoft / Google.
              </p>
            </header>

            {authDisabled ? (
              <div className="mb-4">
                <LegalAlert tone="info">
                  وضع التطوير مفتوح حاليًا (المصادقة غير مفروضة). يمكنك الدخول بحسابك، أو{" "}
                  <Link href={nextUrl} className="font-semibold underline underline-offset-4">
                    المتابعة مباشرة إلى المنصة
                  </Link>
                  .
                </LegalAlert>
              </div>
            ) : null}

            {oauthError ? (
              <div className="mb-4">
                <LegalAlert tone="danger">{oauthError}</LegalAlert>
              </div>
            ) : null}

            <LoginForm
              nextUrl={nextUrl}
              googleEnabled={googleEnabled}
              microsoftEnabled={microsoftEnabled}
            />

            <p className="login-panel__hint">
              ليس لديك حساب؟{" "}
              <Link
                href={`/register?next=${encodeURIComponent(nextUrl)}`}
                className="font-semibold text-[var(--navy)] underline underline-offset-4"
              >
                سجّل مجانًا وابدأ التجربة
              </Link>
              .
            </p>

            <p className="login-panel__links">
              <Link href="/" className="focus-ring underline-offset-4 hover:underline">
                العودة للرئيسية
              </Link>
              <span aria-hidden>·</span>
              <Link href="/privacy" className="focus-ring underline-offset-4 hover:underline">
                الخصوصية
              </Link>
              <span aria-hidden>·</span>
              <Link href="/terms" className="focus-ring underline-offset-4 hover:underline">
                الشروط
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
