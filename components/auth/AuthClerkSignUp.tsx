"use client";

import { useEffect, useState } from "react";
import { SignUp, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";

function SignUpSkeleton() {
  return (
    <div
      className="auth-clerk-skeleton w-full max-w-[25rem] space-y-4 rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل إنشاء الحساب"
    >
      <div className="mx-auto h-7 w-48 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-56 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-4 space-y-2.5">
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/15" />
      <p className="pt-1 text-center text-sm text-[#0E3435]/55">جارٍ تحميل إنشاء الحساب…</p>
    </div>
  );
}

/** بوابة تحميل لـ SignUp بنفس لغة صفحة الدخول. */
export function AuthClerkSignUp({
  forceRedirectUrl = "/auth/continue",
  signInUrl = "/sign-in",
}: {
  forceRedirectUrl?: string;
  signInUrl?: string;
}) {
  const { loaded } = useClerk();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const ready = loaded && mounted;

  return (
    <div className="auth-clerk-wrap flex w-full flex-col items-center">
      {!ready ? <SignUpSkeleton /> : null}
      <div className={ready ? "w-full" : "sr-only"} aria-hidden={!ready}>
        <SignUp
          appearance={clerkAppearance}
          routing="path"
          path="/sign-up"
          signInUrl={signInUrl}
          forceRedirectUrl={forceRedirectUrl}
          fallbackRedirectUrl={forceRedirectUrl}
        />
      </div>
    </div>
  );
}
