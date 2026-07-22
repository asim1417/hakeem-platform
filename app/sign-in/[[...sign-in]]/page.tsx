import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { AuthClerkSignIn } from "@/components/auth/AuthClerkSignIn";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

export default function SignInPage({
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
      compact
      tagline="سجّل الدخول لمتابعة أعمالك القانونية"
      footer={
        <nav className="login-panel__links" aria-label="روابط نظامية">
          <Link href="/privacy">سياسة الخصوصية</Link>
          <span aria-hidden>·</span>
          <Link href="/terms">شروط الاستخدام</Link>
        </nav>
      }
    >
      {configured ? (
        <AuthClerkSignIn nextUrl={nextUrl} routing="path" path="/sign-in" />
      ) : (
        <div
          className="w-full rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-4 py-5 text-center text-sm leading-7 text-[#0E3435]"
          role="status"
        >
          <p className="font-semibold">تسجيل الدخول غير متاح مؤقتًا</p>
          <p className="mt-2 text-[rgba(14,52,53,0.68)]">
            يرجى المحاولة لاحقًا أو التواصل مع مسؤول المنصة.
          </p>
        </div>
      )}
    </AuthJourneyShell>
  );
}
