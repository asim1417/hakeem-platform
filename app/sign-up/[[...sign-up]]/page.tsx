import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { AuthClerkSignUp } from "@/components/auth/AuthClerkSignUp";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { continueUrl, safeDashboardNext } from "@/lib/modules/auth/safe-next";

export const metadata = {
  title: "إنشاء حساب — حكيم",
};

export default function SignUpPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const configured = isClerkConfigured();
  const nextUrl = safeDashboardNext(searchParams?.next);

  return (
    <AuthJourneyShell
      compact
      tagline="أنشئ حسابك وابدأ تجربتك المجانية في دقائق"
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
      {configured ? (
        <AuthClerkSignUp
          nextUrl={nextUrl}
          forceRedirectUrl={continueUrl(nextUrl)}
        />
      ) : (
        <div
          className="w-full rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-4 py-5 text-center text-sm leading-7 text-[#0E3435]"
          role="status"
        >
          <p className="font-semibold">إنشاء الحساب غير متاح مؤقتًا</p>
          <p className="mt-2 text-[rgba(14,52,53,0.68)]">
            يرجى المحاولة لاحقًا أو التواصل مع مسؤول المنصة.
          </p>
        </div>
      )}
    </AuthJourneyShell>
  );
}
