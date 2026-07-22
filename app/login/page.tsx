import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { OwnerEmergencyLogin } from "@/components/auth/OwnerEmergencyLogin";
import { AuthClerkSignIn } from "@/components/auth/AuthClerkSignIn";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

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
    <AuthJourneyShell
      tagline={
        configured
          ? "الدخول عبر Clerk — ثم إكمال الملف والنقاط في مسار واحد."
          : "دخول المالك متاح فورًا — Clerk يُكمّل لاحقًا."
      }
      footer={
        <p className="login-panel__links">
          <Link href="/" className="underline-offset-4 hover:underline">
            الرئيسية
          </Link>
          <span aria-hidden> · </span>
          <Link href="/sign-in" className="underline-offset-4 hover:underline">
            /sign-in
          </Link>
        </p>
      }
    >
      <header className="login-panel__header w-full text-center">
        <p className="login-panel__eyebrow">منصة المعرفة القضائية</p>
        <h2 className="login-panel__title">تسجيل الدخول</h2>
      </header>

      {configured ? (
        <AuthClerkSignIn nextUrl={nextUrl} routing="hash" />
      ) : (
        <OwnerEmergencyLogin nextUrl={nextUrl} clerkEnabled={false} />
      )}
    </AuthJourneyShell>
  );
}
