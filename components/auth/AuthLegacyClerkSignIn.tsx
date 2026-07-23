"use client";

import { SignIn, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";
import { continueUrl } from "@/lib/modules/auth/safe-next";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";
import { AuthGatewaySkeleton } from "@/components/auth/AuthGatewayFailCard";

/**
 * مسار Rollback لواجهة Clerk الافتراضية — يُحمَّل ديناميكيًا فقط عند تعطيل V2.
 */
export function LegacyClerkSignIn({
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
  const mounted = useClerkMounted();
  if (!mounted) {
    return <AuthGatewaySkeleton label="جارٍ تحميل بوابة الدخول…" />;
  }
  return (
    <LegacyClerkSignInInner
      nextUrl={nextUrl}
      routing={routing}
      path={path}
      signUpUrl={signUpUrl}
    />
  );
}

function LegacyClerkSignInInner({
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
      {!loaded ? <AuthGatewaySkeleton label="جارٍ تحميل بوابة الدخول…" /> : null}
      <div className={loaded ? "w-full" : "sr-only"} aria-hidden={!loaded}>
        {routing === "path" ? (
          <SignIn
            appearance={clerkAppearance}
            routing="path"
            path={path}
            signUpUrl={signUpUrl}
            fallbackRedirectUrl={afterAuth}
          />
        ) : (
          <SignIn
            appearance={clerkAppearance}
            routing="hash"
            signUpUrl={signUpUrl}
            fallbackRedirectUrl={afterAuth}
          />
        )}
      </div>
    </div>
  );
}
