import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";

export const dynamic = "force-dynamic";

/**
 * بعد Clerk → وجهة آمنة. إن لم تكتمل الجلسة نعرض صفحة واضحة بدل حلقة صامتة.
 */
export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    redirect(safeDashboardNext(searchParams?.next));
  }

  const next = safeDashboardNext(searchParams?.next);
  const signInHref = `/sign-in?next=${encodeURIComponent(next)}`;

  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#F7F4EE] px-4"
      lang="ar"
      dir="rtl"
    >
      <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
        <p className="text-lg font-bold text-[#0E3435]">حكيم</p>
        <p className="mt-3 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
          لم تكتمل جلسة الدخول بعد. أعد المحاولة من صفحة تسجيل الدخول.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link
            href={signInHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-5 text-sm font-semibold text-[#0E3435]"
          >
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
