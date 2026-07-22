import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { OwnerEmergencyLogin } from "@/components/auth/OwnerEmergencyLogin";
import { AuthClerkSignIn } from "@/components/auth/AuthClerkSignIn";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

/**
 * /login يبقى صالحًا دائمًا (حتى لو /sign-in لم يُبنَ بعد).
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
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
              {configured
                ? "الدخول عبر Clerk — منصة المعرفة القضائية."
                : "دخول المالك متاح فورًا — Clerk يُكمّل لاحقًا."}
            </p>
          </div>
        </aside>
        <section className="login-panel">
          <div className="login-panel__card flex w-full flex-col items-center gap-5">
            <header className="login-panel__header w-full text-center">
              <p className="login-panel__eyebrow">منصة المعرفة القضائية</p>
              <h2 className="login-panel__title">تسجيل الدخول</h2>
            </header>

            {configured ? (
              <AuthClerkSignIn nextUrl={nextUrl} routing="hash" />
            ) : (
              <OwnerEmergencyLogin nextUrl={nextUrl} clerkEnabled={false} />
            )}

            <p className="login-panel__links">
              <Link href="/" className="underline-offset-4 hover:underline">
                الرئيسية
              </Link>
              <span aria-hidden> · </span>
              <Link href="/sign-in" className="underline-offset-4 hover:underline">
                /sign-in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
