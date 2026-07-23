"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { ClientErrorBoundary } from "@/components/providers/ClientErrorBoundary";
import { clerkAppearance, clerkLocalization } from "@/lib/modules/auth/clerk-config";

const AFTER_AUTH = "/auth/continue";

/** هل رُكِّب ClerkProvider على العميل؟ الصفحة العامة تعمل بدونه. */
const ClerkMountContext = createContext(false);

export function useClerkMounted(): boolean {
  return useContext(ClerkMountContext);
}

type ClerkProviderProps = {
  publishableKey: string;
  appearance: unknown;
  localization: unknown;
  signInUrl: string;
  signUpUrl: string;
  afterSignOutUrl: string;
  signInFallbackRedirectUrl: string;
  signUpFallbackRedirectUrl: string;
  telemetry: boolean;
  children: ReactNode;
};

/**
 * Clerk يُحمَّل على العميل فقط بعد أول رسم.
 * هذا يمنع سقوط الصفحة الرئيسية على iOS (SSR/hydration + pk_test_).
 */
export function ClerkAppProvider({
  children,
  publishableKey,
  hideDevelopmentMode = false,
}: {
  children: ReactNode;
  publishableKey?: string;
  hideDevelopmentMode?: boolean;
}) {
  const [ClerkProvider, setClerkProvider] = useState<ComponentType<ClerkProviderProps> | null>(
    null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!publishableKey) return;
    let cancelled = false;
    import("@clerk/nextjs")
      .then((mod) => {
        if (cancelled) return;
        setClerkProvider(() => mod.ClerkProvider as ComponentType<ClerkProviderProps>);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [publishableKey]);

  if (!publishableKey) {
    return <ClerkMountContext.Provider value={false}>{children}</ClerkMountContext.Provider>;
  }

  // أول رسم + SSR: بدون Clerk — الرئيسية وHTML الثابت يبقيان ظاهرين
  if (!ClerkProvider || failed) {
    return <ClerkMountContext.Provider value={false}>{children}</ClerkMountContext.Provider>;
  }

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
    <ClientErrorBoundary
      fallback={<ClerkMountContext.Provider value={false}>{children}</ClerkMountContext.Provider>}
    >
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={appearance}
        localization={clerkLocalization}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        afterSignOutUrl="/"
        signInFallbackRedirectUrl={AFTER_AUTH}
        signUpFallbackRedirectUrl={AFTER_AUTH}
        telemetry={false}
      >
        <ClerkMountContext.Provider value={true}>{children}</ClerkMountContext.Provider>
      </ClerkProvider>
    </ClientErrorBoundary>
  );
}
