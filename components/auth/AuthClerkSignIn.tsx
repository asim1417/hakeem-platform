"use client";

import { useEffect, useState } from "react";
import { SignIn, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";
import { OwnerEmergencyLogin } from "@/components/auth/OwnerEmergencyLogin";

function SignInSkeleton() {
  return (
    <div
      className="w-full max-w-[25rem] space-y-4 rounded-[0.5rem] border border-[#C69763]/30 bg-[#F9F5EC] p-8"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل تسجيل الدخول"
    >
      <div className="mx-auto h-7 w-52 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-64 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-6 space-y-3">
        <div className="h-10 animate-pulse rounded-md bg-[#0E3435]/8" />
        <div className="h-10 animate-pulse rounded-md bg-[#0E3435]/8" />
        <div className="h-10 animate-pulse rounded-md bg-[#0E3435]/8" />
      </div>
      <div className="h-11 animate-pulse rounded-md bg-[#0E3435]/15" />
      <p className="pt-2 text-center text-sm text-[#0E3435]/60">جارٍ تحميل تسجيل الدخول…</p>
    </div>
  );
}

/**
 * يمنع وميض «دخول المالك» قبل ظهور Clerk:
 * هيكل تحميل أولًا → SignIn بعد جاهزية clerk-js → الطوارئ لاحقًا ومطوي.
 */
export function AuthClerkSignIn({
  nextUrl,
  routing = "path",
  path = "/sign-in",
  signUpUrl = "/sign-up",
}: {
  nextUrl: string;
  routing?: "path" | "hash";
  path?: string;
  signUpUrl?: string;
}) {
  const { loaded } = useClerk();
  const [showEmergency, setShowEmergency] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => setShowEmergency(true), 800);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {!loaded ? <SignInSkeleton /> : null}
      <div className={loaded ? "w-full" : "hidden"} aria-hidden={!loaded}>
        {routing === "path" ? (
          <SignIn
            appearance={clerkAppearance}
            routing="path"
            path={path}
            signUpUrl={signUpUrl}
            forceRedirectUrl={nextUrl}
            fallbackRedirectUrl={nextUrl}
          />
        ) : (
          <SignIn
            appearance={clerkAppearance}
            routing="hash"
            signUpUrl={signUpUrl}
            forceRedirectUrl={nextUrl}
            fallbackRedirectUrl={nextUrl}
          />
        )}
      </div>
      {showEmergency ? <OwnerEmergencyLogin nextUrl={nextUrl} clerkEnabled /> : null}
    </div>
  );
}
