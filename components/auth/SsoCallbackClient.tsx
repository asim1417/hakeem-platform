"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";

const AFTER_AUTH = "/auth/continue";
const FALLBACK_MS = 12_000;

/**
 * يكمل جلسة OAuth داخل نطاق التطبيق ويعود لـ /auth/continue.
 */
export function SsoCallbackClient() {
  const clerkMounted = useClerkMounted();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (timedOut) {
    return (
      <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
        <p className="text-sm font-semibold text-[#0E3435]">تعذّر إكمال تسجيل الدخول</p>
        <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">
          انتهت مهلة الربط مع مزوّد الدخول. أعد المحاولة من صفحة الدخول.
        </p>
        <Link
          href="/sign-in"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7] hover:bg-[#164849]"
        >
          العودة لتسجيل الدخول
        </Link>
      </div>
    );
  }

  if (!clerkMounted) {
    return (
      <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
          aria-hidden
        />
        <p className="mt-4 text-sm font-semibold text-[#0E3435]">جارٍ تجهيز الجلسة…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
        aria-hidden
      />
      <p className="mt-4 text-sm font-semibold text-[#0E3435]">جارٍ إكمال الدخول…</p>
      <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">لا تغلق هذه النافذة.</p>
      <AuthenticateWithRedirectCallback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        continueSignUpUrl="/sign-up"
        signInFallbackRedirectUrl={AFTER_AUTH}
        signUpFallbackRedirectUrl={AFTER_AUTH}
      />
    </div>
  );
}
