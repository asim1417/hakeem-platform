"use client";

import { useEffect, useState } from "react";
import { SignUp, useClerk } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";
import { AuthGatewaySkeleton } from "@/components/auth/AuthGatewayFailCard";

/**
 * مسار Rollback لواجهة Clerk الافتراضية — يُحمَّل ديناميكيًا فقط عند تعطيل V2.
 */
export function LegacyClerkSignUp({
  forceRedirectUrl,
  signInUrl,
}: {
  forceRedirectUrl: string;
  signInUrl: string;
}) {
  const clerkMounted = useClerkMounted();
  if (!clerkMounted) {
    return <AuthGatewaySkeleton label="جارٍ تحميل إنشاء الحساب…" />;
  }
  return <LegacyClerkSignUpInner forceRedirectUrl={forceRedirectUrl} signInUrl={signInUrl} />;
}

function LegacyClerkSignUpInner({
  forceRedirectUrl,
  signInUrl,
}: {
  forceRedirectUrl: string;
  signInUrl: string;
}) {
  const { loaded } = useClerk();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const ready = loaded && mounted;

  return (
    <div className="auth-clerk-wrap flex w-full flex-col items-center">
      {!ready ? <AuthGatewaySkeleton label="جارٍ تحميل إنشاء الحساب…" /> : null}
      <div className={ready ? "w-full" : "sr-only"} aria-hidden={!ready}>
        <SignUp
          appearance={clerkAppearance}
          routing="path"
          path="/sign-up"
          signInUrl={signInUrl}
          fallbackRedirectUrl={forceRedirectUrl}
        />
      </div>
    </div>
  );
}
