import Link from "next/link";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

/**
 * /login → إعادة توجيه موحّدة إلى /sign-in مع الحفاظ على next.
 * لا يعرض دخول مالك ولا معلومات تقنية.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next =
    searchParams?.next && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
      ? searchParams.next
      : undefined;

  if (isClerkConfigured()) {
    const qs = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/sign-in${qs}`);
  }

  return (
    <main className="login-page login-page--compact" lang="ar" dir="rtl">
      <div className="login-panel" style={{ minHeight: "100dvh" }}>
        <div className="login-panel__card w-full max-w-md rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
          <h1 className="text-xl font-bold text-[#0E3435]">تسجيل الدخول غير متاح مؤقتًا</h1>
          <p className="mt-3 text-sm leading-7 text-[rgba(14,52,53,0.68)]">
            يرجى المحاولة لاحقًا أو التواصل مع مسؤول المنصة.
          </p>
          <nav className="login-panel__links mt-6" aria-label="روابط نظامية">
            <Link href="/privacy">سياسة الخصوصية</Link>
            <span aria-hidden>·</span>
            <Link href="/terms">شروط الاستخدام</Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
