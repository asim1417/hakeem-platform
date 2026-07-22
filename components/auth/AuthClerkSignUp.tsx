"use client";

import { useEffect, useState } from "react";
import { SignUp, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";

function SignUpSkeleton() {
  return (
    <div
      className="w-full max-w-[25rem] space-y-4 rounded-[0.5rem] border border-[#C69763]/30 bg-[#F9F5EC] p-8"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل إنشاء الحساب"
    >
      <div className="mx-auto h-7 w-56 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-64 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-6 space-y-3">
        <div className="h-10 animate-pulse rounded-md bg-[#0E3435]/8" />
        <div className="h-10 animate-pulse rounded-md bg-[#0E3435]/8" />
        <div className="h-10 animate-pulse rounded-md bg-[#0E3435]/8" />
      </div>
      <div className="h-11 animate-pulse rounded-md bg-[#0E3435]/15" />
      <p className="pt-2 text-center text-sm text-[#0E3435]/60">جارٍ تحميل إنشاء الحساب…</p>
    </div>
  );
}

/** بوابة تحميل لـ SignUp بنفس لغة AuthClerkSignIn. */
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

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {!loaded || !mounted ? <SignUpSkeleton /> : null}
      <div className={loaded && mounted ? "w-full" : "hidden"} aria-hidden={!loaded}>
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
