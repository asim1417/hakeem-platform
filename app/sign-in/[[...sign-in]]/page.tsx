import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { setup?: string };
}) {
  const configured = isClerkConfigured();
  const needsSetup = !configured || searchParams?.setup === "1";

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
            <p className="login-brand__tagline">الدخول عبر Clerk — بريد، Google، أو غيرها.</p>
          </div>
        </aside>
        <section className="login-panel">
          <div className="login-panel__card flex flex-col items-center">
            {needsSetup && !configured ? (
              <div className="mb-4 w-full rounded-[var(--r-md)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm leading-7 text-[var(--amber)]">
                <p className="font-semibold">يلزم ضبط مفاتيح Clerk</p>
                <p className="mt-1">
                  أضف في Vercel: <code dir="ltr">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> و{" "}
                  <code dir="ltr">CLERK_SECRET_KEY</code> ثم أعد النشر. المصادقة السابقة أُلغيت.
                </p>
              </div>
            ) : null}
            {configured ? (
              <SignIn
                appearance={clerkAppearance}
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                forceRedirectUrl="/onboarding"
                fallbackRedirectUrl="/dashboard"
              />
            ) : null}
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
