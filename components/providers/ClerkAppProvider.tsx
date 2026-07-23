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

function isClerkRuntimeNoise(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("clerk") ||
    m.includes("dev-browser") ||
    m.includes("__clerk") ||
    m.includes("failed to load") ||
    m.includes("loading chunk")
  );
}

/**
 * Clerk يُحمَّل على العميل فقط بعد أول رسم.
 * يمنع سقوط الصفحة على iOS (SSR/hydration + pk_test_ + تقييم وحدة Clerk).
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
  const [appearance, setAppearance] = useState<unknown>(null);
  const [localization, setLocalization] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!publishableKey) return;
    let cancelled = false;

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : String(reason ?? "");
      if (isClerkRuntimeNoise(msg)) {
        event.preventDefault();
        if (!cancelled) setFailed(true);
      }
    };
    const onError = (event: ErrorEvent) => {
      const msg = event.message || "";
      if (isClerkRuntimeNoise(msg)) {
        event.preventDefault();
        if (!cancelled) setFailed(true);
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("error", onError);

    Promise.all([import("@clerk/nextjs"), import("@/lib/modules/auth/clerk-config")])
      .then(([clerkMod, configMod]) => {
        if (cancelled) return;
        const baseAppearance = configMod.clerkAppearance;
        const nextAppearance = hideDevelopmentMode
          ? {
              ...baseAppearance,
              layout: {
                ...baseAppearance.layout,
                unsafe_disableDevelopmentModeWarnings: true,
              },
            }
          : baseAppearance;
        setAppearance(nextAppearance);
        setLocalization(configMod.clerkLocalization);
        setClerkProvider(() => clerkMod.ClerkProvider as ComponentType<ClerkProviderProps>);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("error", onError);
    };
  }, [publishableKey, hideDevelopmentMode]);

  if (!publishableKey) {
    return <ClerkMountContext.Provider value={false}>{children}</ClerkMountContext.Provider>;
  }

  // أول رسم + فشل التحميل: بدون Clerk — بوابة الدخول تعرض Skeleton ثم FailCard
  if (!ClerkProvider || !appearance || !localization || failed) {
    return <ClerkMountContext.Provider value={false}>{children}</ClerkMountContext.Provider>;
  }

  return (
    <ClientErrorBoundary
      fallback={<ClerkMountContext.Provider value={false}>{children}</ClerkMountContext.Provider>}
    >
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={appearance}
        localization={localization}
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
