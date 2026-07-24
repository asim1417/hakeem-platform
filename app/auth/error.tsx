"use client";

/**
 * أخطاء مسار /auth/* تُحتوى هنا — لا تُرفع إلى global-error.
 */
export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#F7F4EE] px-4"
      lang="ar"
      dir="rtl"
    >
      <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
        <p className="text-lg font-bold text-[#0E3435]">حكيم</p>
        <p className="mt-3 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
          تعذّر إكمال تسجيل الدخول مؤقتًا. أعد المحاولة أو ارجع لصفحة الدخول.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
          >
            إعادة المحاولة
          </button>
          <a
            href="/sign-in"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-5 text-sm font-semibold text-[#0E3435]"
          >
            تسجيل الدخول
          </a>
          <a
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-5 text-sm font-semibold text-[#0E3435]"
          >
            الصفحة الرئيسية
          </a>
        </div>
      </div>
    </main>
  );
}
