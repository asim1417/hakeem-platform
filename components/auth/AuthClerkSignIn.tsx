"use client";

import { SignIn, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";
import { AuthOauthOnly } from "@/components/auth/AuthOauthOnly";
import { isAuthGatewayUxV2Enabled } from "@/lib/modules/config/auth-gateway";
import { continueUrl } from "@/lib/modules/auth/safe-next";

function SignInSkeleton() {
  return (
    <div
      className="auth-clerk-skeleton w-full max-w-[25rem] space-y-4 rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]"
      role="status"
      aria-live="polite"
      aria-label="جارٍ تحميل تسجيل الدخول"
    >
      <div className="mx-auto h-7 w-48 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-56 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-4 space-y-2.5">
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
          <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        </div>
      </div>
      <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/15" />
      <p className="pt-1 text-center text-sm text-[#0E3435]/55">جارٍ تحميل تسجيل الدخول…</p>
    </div>
  );
}

function LegacyClerkSignIn({
  nextUrl,
  routing,
  path,
  signUpUrl,
}: {
  nextUrl: string;
  routing: "path" | "hash";
  path: string;
  signUpUrl: string;
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
    </div>
  );
}

/**
 * تسجيل الدخول — افتراضيًا Google/Apple فقط (AUTH_GATEWAY_UX_V2).
 * عند إيقاف العلم: يعود نموذج Clerk السابق (Rollback).
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
  if (isAuthGatewayUxV2Enabled()) {
    return <AuthOauthOnly mode="sign-in" nextUrl={nextUrl} />;
  }
  return (
    <LegacyClerkSignIn nextUrl={nextUrl} routing={routing} path={path} signUpUrl={signUpUrl} />
  );
}
