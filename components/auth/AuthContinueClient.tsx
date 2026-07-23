"use client";

import { useEffect, useState } from "react";

/**
 * بعد العودة من OAuth قد تتأخر الكوكيز/الـ handshake لحظات على Safari.
 * نعيد المحاولة قبل إظهار رسالة الفشل، ونوجّه لبوابة /sign-in الموحّدة.
 */
export function AuthContinueClient({ nextPath }: { nextPath: string }) {
  const [status, setStatus] = useState<"wait" | "fail">("wait");
  const signInHref = `/sign-in?next=${encodeURIComponent(nextPath)}`;
  const continueHref = `/auth/continue?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 8;

    async function tick() {
      attempts += 1;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
        if (res.ok) {
          const data = (await res.json()) as { user?: unknown; isGuest?: boolean };
          if (data?.user && !data.isGuest) {
            window.location.replace(nextPath);
            return;
          }
        }
      } catch {
        /* جرّب مجددًا */
      }

      if (cancelled) return;
      if (attempts >= maxAttempts) {
        setStatus("fail");
        return;
      }
      window.setTimeout(() => {
        if (!cancelled) void tick();
      }, 700);
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  if (status === "wait") {
    return (
      <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
          aria-hidden
        />
        <p className="mt-4 text-sm font-semibold text-[#0E3435]">جارٍ تحويلك بأمان…</p>
        <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">لا تغلق هذه النافذة.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <p className="text-lg font-bold text-[#0E3435]">حكيم</p>
      <p className="mt-3 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
        تعذّر تحميل بوابة الدخول. أعد المحاولة أو عد إلى الصفحة الرئيسية.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <a
          href={continueHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
        >
          إعادة المحاولة
        </a>
        <a
          href={signInHref}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-5 text-sm font-semibold text-[#0E3435]"
        >
          العودة لتسجيل الدخول
        </a>
        <a
          href="/"
          className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-5 text-sm font-semibold text-[#0E3435]"
        >
          الصفحة الرئيسية
        </a>
      </div>
    </div>
  );
}
