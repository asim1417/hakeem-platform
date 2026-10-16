"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";
import { AuthGatewayFailCard, AuthGatewaySkeleton } from "@/components/auth/AuthGatewayFailCard";

type InnerProps = {
  mode: "sign-in" | "sign-up";
  nextUrl: string;
  portalFallbackHref: string;
};

/**
 * غلاف آمن لنموذج الدخول العربي: بلا استيراد ثابت لـ @clerk/nextjs.
 * يحمّل الـ Inner بعد تركيب ClerkProvider — نفس نمط AuthOauthOnly لحماية iPhone/Safari.
 */
export function AuthIdentifierFlow(props: InnerProps) {
  const mounted = useClerkMounted();
  const [waited, setWaited] = useState(false);
  const [Inner, setInner] = useState<ComponentType<InnerProps> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const isSignIn = props.mode === "sign-in";

  useEffect(() => {
    if (mounted) return;
    const id = window.setTimeout(() => setWaited(true), 10000);
    return () => window.clearTimeout(id);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    import("@/components/auth/AuthIdentifierFlowInner")
      .then((mod) => {
        if (!cancelled) setInner(() => mod.AuthIdentifierFlowInner);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  if (loadFailed || (waited && !mounted)) {
    return <AuthGatewayFailCard isSignIn={isSignIn} />;
  }
  if (!mounted || !Inner) {
    return <AuthGatewaySkeleton label="جارٍ تجهيز الدخول الآمن…" />;
  }
  return <Inner {...props} />;
}
