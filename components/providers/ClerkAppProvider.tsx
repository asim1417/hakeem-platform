"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance } from "@/lib/modules/auth/clerk-config";

/** يغلّف التطبيق بـ Clerk عند توفر المفتاح العلني. */
export function ClerkAppProvider({
  children,
  publishableKey,
}: {
  children: React.ReactNode;
  publishableKey?: string;
}) {
  if (!publishableKey) return <>{children}</>;
  return (
    <ClerkProvider publishableKey={publishableKey} appearance={clerkAppearance} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}
