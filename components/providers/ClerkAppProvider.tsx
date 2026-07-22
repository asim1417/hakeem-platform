"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance, clerkLocalization } from "@/lib/modules/auth/clerk-config";

/** يغلّف التطبيق بـ Clerk عند توفر المفتاح العلني — عربية + هوية حكيم. */
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
      afterSignOutUrl="/"
    >
      {children}
    </ClerkProvider>
  );
}
