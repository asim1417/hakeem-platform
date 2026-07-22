"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance, clerkLocalization } from "@/lib/modules/auth/clerk-config";

const AFTER_AUTH = "/auth/continue";

/** يغلّف التطبيق بـ Clerk — عربية + هوية حكيم + توجيه إجباري بعد الدخول للوحة. */
export function ClerkAppProvider({
  children,
  publishableKey,
}: {
  children: React.ReactNode;
  publishableKey?: string;
}) {
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={clerkAppearance}
      localization={clerkLocalization}
      afterSignOutUrl="/sign-in"
      signInFallbackRedirectUrl={AFTER_AUTH}
      signUpFallbackRedirectUrl={AFTER_AUTH}
      signInForceRedirectUrl={AFTER_AUTH}
      signUpForceRedirectUrl={AFTER_AUTH}
    >
      {children}
    </ClerkProvider>
  );
}
