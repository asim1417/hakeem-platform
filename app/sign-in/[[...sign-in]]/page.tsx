import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { AuthOauthButtons } from "@/components/auth/AuthOauthButtons";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { resolvePostAuthNext } from "@/lib/modules/auth/safe-next";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

/** بوابة الدخول — تُبقي /sign-in للروابط المحمية؛ الواجهة الأساسية على الرئيسية */
export default function SignInPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string };
}) {
  const configured = isClerkConfigured();
  const nextUrl = resolvePostAuthNext(searchParams);

  // الروابط العميقة والـ middleware ما زالت تصل هنا — نفس لوحة الأزرار بلا Clerk JS
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
      {configured ? (
        <AuthOauthButtons mode="sign-in" nextUrl={nextUrl} />
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
