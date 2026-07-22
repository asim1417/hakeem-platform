import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { isClerkConfigured, clerkAppearance } from "@/lib/modules/auth/clerk-config";
import { OwnerEmergencyLogin } from "@/components/auth/OwnerEmergencyLogin";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { setup?: string; next?: string };
}) {
  const configured = isClerkConfigured();
  const nextUrl =
    searchParams?.next && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
      ? searchParams.next
      : "/dashboard";

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
              {configured ? "الدخول عبر Clerk." : "دخول المالك متاح الآن — Clerk يُضبط لاحقًا."}
            </p>
          </div>
        </aside>
        <section className="login-panel">
          <div className="login-panel__card flex w-full flex-col items-center gap-5">
            {!configured ? (
              <div className="w-full rounded-[var(--r-md)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm leading-7 text-[var(--amber)]">
                مفاتيح Clerk غير مضبوطة بعد. استخدم <strong>دخول المالك</strong> بالأسفل للوصول فورًا.
              </div>
            ) : null}

            {configured ? (
              <SignIn
                appearance={clerkAppearance}
                routing="path"
                path="/sign-in"
                signUpUrl="/sign-up"
                forceRedirectUrl={nextUrl}
                fallbackRedirectUrl={nextUrl}
              />
            ) : null}

            <OwnerEmergencyLogin nextUrl={nextUrl} clerkEnabled={configured} />

            <p className="login-panel__links">
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
