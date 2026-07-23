"use client";

/**
 * حالة فشل بوابة الدخول — تبقى داخل البطاقة ولا تسقط التطبيق إلى global-error.
 */
export function AuthGatewayFailCard({
  isSignIn = true,
  onRetry,
}: {
  isSignIn?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <p className="text-sm font-semibold text-[#0E3435]">تعذّر تحميل بوابة الدخول</p>
      <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">
        لم تكتمل خدمة تسجيل الدخول. أعد المحاولة، أو عد إلى الصفحة الرئيسية.
      </p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
        onClick={() => {
          if (onRetry) onRetry();
          else if (typeof window !== "undefined") window.location.reload();
        }}
      >
        إعادة تحميل بوابة الدخول
      </button>
      <p className="mt-3">
        <a href="/" className="text-sm font-semibold text-[rgba(14,52,53,0.65)]">
          العودة إلى الصفحة الرئيسية
        </a>
      </p>
      <p className="mt-2 text-xs text-[rgba(14,52,53,0.45)]">
        {isSignIn ? "بوابة الدخول الموحّدة: /sign-in" : "بوابة التسجيل الموحّدة: /sign-up"}
      </p>
    </div>
  );
}

export function AuthGatewaySkeleton({ label }: { label: string }) {
  return (
    <div
      className="w-full max-w-[25rem] space-y-4 rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="mx-auto h-7 w-48 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-64 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-4 space-y-2.5">
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
      </div>
      <p className="pt-1 text-center text-sm text-[#0E3435]/55">{label}</p>
    </div>
  );
}
