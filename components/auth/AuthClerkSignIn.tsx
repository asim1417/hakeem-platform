"use client";

import { SignIn, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";

function SignInSkeleton() {
  return (
    <div
      className="auth-clerk-skeleton w-full max-w-[25rem] space-y-4 rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل تسجيل الدخول"
    >
      <div className="mx-auto h-7 w-48 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-64 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-4 space-y-2.5">
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
          <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        </div>
      </div>
      <p className="pt-1 text-center text-sm text-[#0E3435]/55">جارٍ تحميل تسجيل الدخول…</p>
    </div>
  );
}

function continueUrl(nextUrl: string) {
  const safe =
    nextUrl.startsWith("/dashboard") && !nextUrl.startsWith("//") ? nextUrl : "/dashboard";
  return `/auth/continue?next=${encodeURIComponent(safe)}`;
}

/** نموذج Clerk — دخول عبر Google / Apple / Microsoft فقط (بدون حقل بريد مضلّل). */
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
  const afterAuth = continueUrl(nextUrl);

  return (
    <div className="auth-clerk-wrap flex w-full flex-col items-center">
      {!loaded ? <SignInSkeleton /> : null}
      <div className={loaded ? "w-full" : "sr-only"} aria-hidden={!loaded}>
        {routing === "path" ? (
          <SignIn
            appearance={clerkAppearance}
            routing="path"
            path={path}
            signUpUrl={signUpUrl}
            forceRedirectUrl={afterAuth}
            fallbackRedirectUrl={afterAuth}
          />
        ) : (
          <SignIn
            appearance={clerkAppearance}
            routing="hash"
            signUpUrl={signUpUrl}
            forceRedirectUrl={afterAuth}
            fallbackRedirectUrl={afterAuth}
          />
        )}
      </div>
      {loaded ? (
        <p className="mt-1 max-w-[25rem] text-center text-xs leading-6 text-[rgba(14,52,53,0.55)]">
          الدخول متاح عبر Google أو Apple أو Microsoft فقط.
        </p>
      ) : null}
    </div>
  );
}
