import Link from "next/link";
import { RegisterForm } from "@/components/RegisterForm";
import { CREDIT_REWARDS } from "@/config/credits";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";
import { safeNextPath } from "@/lib/modules/auth/oauth-shared";

export const metadata = {
  title: "إنشاء حساب — حكيم",
  description: "سجّل في منصة حكيم وابدأ تجربتك المجانية مع نقاط ترحيبية.",
};

function normalizeRef(raw?: string): string {
  const code = (raw || "").trim().toUpperCase();
  return code.startsWith("HKM-") && code.length <= 32 ? code : "";
}

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { next?: string; ref?: string };
}) {
  const nextUrl = safeNextPath(searchParams?.next);
  const referralCode = normalizeRef(searchParams?.ref);
  const googleEnabled = isGoogleOAuthConfigured();
  const microsoftEnabled = isMicrosoftOAuthConfigured();
  const oauthQs = new URLSearchParams({ next: "/onboarding" });
  if (referralCode) oauthQs.set("ref", referralCode);

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
            <p className="login-brand__tagline">
              احصل على {CREDIT_REWARDS.welcome} نقطة ترحيبية — ثم أكمل ملفك لتحليل الوقائع واقتراح الدفوع.
            </p>
            <ul className="login-brand__points">
              <li>+{CREDIT_REWARDS.welcome} نقطة عند التسجيل + مكافآت إكمال الملف</li>
              <li>تسجيل للمحامي الفرد (ميزة أمام المنافسين)</li>
              <li>تجربة مجانية مباشرة — بلا بطاقة دفع</li>
            </ul>
          </div>
        </aside>

        <section className="login-panel" aria-labelledby="register-heading">
          <div className="login-panel__card">
            <header className="login-panel__header">
              <p className="login-panel__eyebrow">تجربة مجانية · +{CREDIT_REWARDS.welcome} نقطة</p>
              <h2 id="register-heading" className="login-panel__title">
                إنشاء حساب
              </h2>
              <p className="login-panel__desc">أنشئ حسابك خلال دقيقة، ثم أكمل ملفك واكسب نقاطًا إضافية.</p>
            </header>

            {(googleEnabled || microsoftEnabled) && (
              <div className="mb-5 space-y-3">
                {microsoftEnabled ? (
                  <a
                    href={`/api/auth/microsoft?${oauthQs.toString()}`}
                    className="login-sso-btn login-sso-microsoft focus-ring"
                  >
                    التسجيل عبر بوابة Microsoft
                  </a>
                ) : null}
                {googleEnabled ? (
                  <a
                    href={`/api/auth/google?${oauthQs.toString()}`}
                    className="login-sso-btn login-sso-google focus-ring"
                  >
                    التسجيل عبر Google
                  </a>
                ) : null}
                <div className="flex items-center gap-3 py-1 text-xs text-[var(--ink-40)]" role="separator">
                  <span className="h-px flex-1 bg-[var(--gold-border)]" />
                  أو بالبيانات
                  <span className="h-px flex-1 bg-[var(--gold-border)]" />
                </div>
              </div>
            )}

            <RegisterForm nextUrl={nextUrl} referralCode={referralCode} />

            <p className="login-panel__links mt-6">
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
