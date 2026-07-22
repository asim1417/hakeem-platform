"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance, clerkLocalization } from "@/lib/modules/auth/clerk-config";

const AFTER_AUTH = "/auth/continue";

/** يغلّف التطبيق بـ Clerk — عربية + هوية حكيم + توجيه إجباري بعد الدخول للوحة. */
export function ClerkAppProvider({
  children,
  publishableKey,
  hideDevelopmentMode = false,
}: {
  children: React.ReactNode;
  publishableKey?: string;
  /** من الخادم: أخفِ شارة Development mode في النشر الفعلي. */
  hideDevelopmentMode?: boolean;
}) {
  if (!publishableKey) return <>{children}</>;

  const appearance = hideDevelopmentMode
    ? {
        ...clerkAppearance,
        layout: {
          ...clerkAppearance.layout,
          unsafe_disableDevelopmentModeWarnings: true,
        },
      }
    : clerkAppearance;

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      appearance={appearance}
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
