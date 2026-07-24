"use client";

import { useEffect, useState } from "react";

/**
 * بعد العودة من OAuth قد تتأخر الكوكيز لحظات (Safari / سباق Redirect).
 * نبقي حالة انتظار محايدة ونواصل الاستطلاع — لا نعلن فشلًا كاذبًا بعد مهلة قصيرة.
 */
export function AuthContinueClient({ nextPath }: { nextPath: string }) {
  const [phase, setPhase] = useState<"wait" | "slow">("wait");
  const signInHref = `/sign-in?next=${encodeURIComponent(nextPath)}`;
  const continueHref = `/auth/continue?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    /** بعد ~12ث نعرض «ما زلنا نكمل» مع الإبقاء على الاستطلاع */
    const slowAfterAttempts = 16;
    const gapMs = 750;

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
      if (attempts >= slowAfterAttempts) {
        setPhase("slow");
      }
      window.setTimeout(() => {
        if (!cancelled) void tick();
      }, gapMs);
    }

    void tick();
    return () => {
      cancelled = true;
    };
  }, [nextPath]);

  return (
    <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
        aria-hidden
      />
      <p className="mt-4 text-sm font-semibold text-[#0E3435]">
        {phase === "wait" ? "جارٍ إكمال تسجيل الدخول…" : "ما زلنا نكمل تسجيل الدخول…"}
      </p>
      <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">
        {phase === "wait"
          ? "لا تغلق هذه النافذة."
          : "يستغرق التثبيت أحيانًا لحظات إضافية. يمكنك إعادة المحاولة دون فقدان الجلسة إن اكتملت."}
      </p>
      {phase === "slow" ? (
        <div className="mt-5 flex flex-col gap-2">
          <a
            href={continueHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
          >
            متابعة التحقق
          </a>
          <a
            href={signInHref}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-5 text-sm font-semibold text-[#0E3435]"
          >
            العودة لتسجيل الدخول
          </a>
        </div>
      ) : null}
    </div>
  );
}
