import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { isClerkConfigured, clerkAppearance } from "@/lib/modules/auth/clerk-config";

export const metadata = {
  title: "إنشاء حساب — حكيم",
};

export default function SignUpPage() {
  const configured = isClerkConfigured();

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
            <p className="login-brand__tagline">سجّل عبر Clerk واحصل على نقاط ترحيبية بعد إكمال الملف.</p>
          </div>
        </aside>
        <section className="login-panel">
          <div className="login-panel__card flex flex-col items-center">
            {configured ? (
              <SignUp
                appearance={clerkAppearance}
                routing="path"
                path="/sign-up"
                signInUrl="/sign-in"
                forceRedirectUrl="/onboarding"
                fallbackRedirectUrl="/onboarding"
              />
            ) : (
              <div className="w-full rounded-[var(--r-md)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm leading-7 text-[var(--amber)]">
                اضبط مفاتيح Clerk في Vercel لتفعيل التسجيل.
              </div>
            )}
            <p className="login-panel__links mt-6">
              <Link href="/" className="underline-offset-4 hover:underline">
                الرئيسية
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
