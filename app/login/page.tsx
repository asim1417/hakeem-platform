import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAnySignInProvider } from "@/lib/modules/auth/auth-providers";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

/**
 * /login → إعادة توجيه موحّدة إلى /sign-in مع الحفاظ على next.
 * لا يعرض دخول مالك ولا معلومات تقنية.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; returnUrl?: string };
}) {
  await hydrateEnvFromSettings().catch(() => 0);

  const nextRaw = searchParams?.next || searchParams?.returnUrl;
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : undefined;

  if (hasAnySignInProvider()) {
    const qs = next ? `?next=${encodeURIComponent(next)}` : "";
    redirect(`/sign-in${qs}`);
  }

  return (
    <main className="login-page login-page--compact" lang="ar" dir="rtl">
      <div className="login-panel" style={{ minHeight: "100dvh" }}>
        <div className="login-panel__card w-full max-w-md rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
          <h1 className="text-xl font-bold text-[#0E3435]">
            تعذّر تحميل بوابة الدخول. أعد المحاولة أو عد إلى الصفحة الرئيسية.
          </h1>
          <p className="mt-3 text-sm leading-7 text-[rgba(14,52,53,0.68)]">
            يرجى المحاولة لاحقًا أو التواصل مع مسؤول المنصة.
          </p>
          <nav className="login-panel__links mt-6" aria-label="روابط نظامية">
            <Link href="/">الرئيسية</Link>
            <span aria-hidden>·</span>
            <Link href="/privacy">سياسة الخصوصية</Link>
            <span aria-hidden>·</span>
            <Link href="/terms">شروط الاستخدام</Link>
          </nav>
        </div>
      </div>
    </main>
  );
}
