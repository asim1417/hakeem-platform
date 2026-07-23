"use client";

import { useState, useEffect, type ComponentType } from "react";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";
import { AuthGatewayFailCard, AuthGatewaySkeleton } from "@/components/auth/AuthGatewayFailCard";

type AuthMode = "sign-in" | "sign-up";

type InnerProps = { mode: AuthMode; nextUrl?: string };

/**
 * غلاف آمن: بلا استيراد ثابت لـ @clerk/nextjs.
 * يحمّل الـ Inner ديناميكيًا بعد تركيب ClerkProvider — يمنع سقوط iPhone عند تقييم وحدة Clerk.
 */
export function AuthOauthOnly(props: InnerProps) {
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
    import("@/components/auth/AuthOauthOnlyInner")
      .then((mod) => {
        if (!cancelled) setInner(() => mod.AuthOauthOnlyInner);
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
    return (
      <AuthGatewaySkeleton
        label={isSignIn ? "جارٍ تحميل بوابة الدخول…" : "جارٍ تحميل إنشاء الحساب…"}
      />
    );
  }

  return <Inner {...props} />;
}
