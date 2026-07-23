"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function SsoCallbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("sso-callback error boundary:", error?.message);
  }, [error]);

  return (
    <main className="login-page login-page--compact" lang="ar" dir="rtl">
      <div className="login-panel" style={{ minHeight: "100dvh" }}>
        <div className="mx-auto w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
          <p className="text-sm font-semibold text-[#0E3435]">تعذّر إكمال تسجيل الدخول</p>
          <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">
            لم تكتمل خدمة تسجيل الدخول. أعد المحاولة، أو عد إلى الصفحة الرئيسية.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
          >
            إعادة المحاولة
          </button>
          <p className="mt-3">
            <Link href="/sign-in" className="text-sm font-semibold text-[rgba(14,52,53,0.65)]">
              العودة لتسجيل الدخول
            </Link>
          </p>
          <p className="mt-2">
            <Link href="/" className="text-sm font-semibold text-[rgba(14,52,53,0.65)]">
              العودة إلى الصفحة الرئيسية
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
