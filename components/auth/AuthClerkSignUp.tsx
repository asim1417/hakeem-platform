"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AuthOauthOnly } from "@/components/auth/AuthOauthOnly";
import { isAuthGatewayUxV2Enabled } from "@/lib/modules/config/auth-gateway";
import { safeDashboardNext } from "@/lib/modules/auth/safe-next";
import { ClientErrorBoundary } from "@/components/providers/ClientErrorBoundary";
import { AuthGatewayFailCard, AuthGatewaySkeleton } from "@/components/auth/AuthGatewayFailCard";

type LegacyProps = {
  forceRedirectUrl: string;
  signInUrl: string;
};

/** إنشاء حساب — بوابة موحّدة /sign-up — بلا استيراد ثابت لـ @clerk/nextjs */
export function AuthClerkSignUp({
  forceRedirectUrl = "/auth/continue?next=%2Fdashboard",
  signInUrl = "/sign-in",
  nextUrl,
}: {
  forceRedirectUrl?: string;
  signInUrl?: string;
  nextUrl?: string;
}) {
  let body: React.ReactNode;
  if (isAuthGatewayUxV2Enabled()) {
    let resolved = nextUrl || "/dashboard";
    if (!nextUrl) {
      try {
        const q = forceRedirectUrl.includes("?") ? forceRedirectUrl.split("?")[1] : "";
        const next = new URLSearchParams(q).get("next");
        if (next) resolved = safeDashboardNext(next);
      } catch {
        resolved = "/dashboard";
      }
    }
    body = <AuthOauthOnly mode="sign-up" nextUrl={resolved} />;
  } else {
    body = (
      <LegacySignUpLoader forceRedirectUrl={forceRedirectUrl} signInUrl={signInUrl} />
    );
  }
  return (
    <ClientErrorBoundary fallback={<AuthGatewayFailCard isSignIn={false} />}>
      {body}
    </ClientErrorBoundary>
  );
}

function LegacySignUpLoader(props: LegacyProps) {
  const [Comp, setComp] = useState<ComponentType<LegacyProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@/components/auth/AuthLegacyClerkSignUp")
      .then((mod) => {
        if (!cancelled) setComp(() => mod.LegacyClerkSignUp);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <AuthGatewayFailCard isSignIn={false} />;
  if (!Comp) return <AuthGatewaySkeleton label="جارٍ تحميل إنشاء الحساب…" />;
  return <Comp {...props} />;
}
