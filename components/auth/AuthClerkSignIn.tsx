"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AuthOauthOnly } from "@/components/auth/AuthOauthOnly";
import { isAuthGatewayUxV2Enabled } from "@/lib/modules/config/auth-gateway";
import { ClientErrorBoundary } from "@/components/providers/ClientErrorBoundary";
import { AuthGatewayFailCard, AuthGatewaySkeleton } from "@/components/auth/AuthGatewayFailCard";

type LegacyProps = {
  nextUrl: string;
  routing: "path" | "hash";
  path: string;
  signUpUrl: string;
};

/**
 * تسجيل الدخول — بوابة موحّدة /sign-in (Google/Apple افتراضيًا).
 * بلا استيراد ثابت لـ @clerk/nextjs حتى لا يسقط تقييم الوحدة التطبيق على iPhone.
 */
export function AuthClerkSignIn({
  nextUrl,
  routing = "path",
  path = "/sign-in",
  signUpUrl = "/sign-up",
}: {
  nextUrl: string;
  routing?: "path" | "hash";
  path?: string;
  signUpUrl?: string;
}) {
  const v2 = isAuthGatewayUxV2Enabled();

  return (
    <ClientErrorBoundary fallback={<AuthGatewayFailCard isSignIn />}>
      {v2 ? (
        <AuthOauthOnly mode="sign-in" nextUrl={nextUrl} />
      ) : (
        <LegacySignInLoader
          nextUrl={nextUrl}
          routing={routing}
          path={path}
          signUpUrl={signUpUrl}
        />
      )}
    </ClientErrorBoundary>
  );
}

function LegacySignInLoader(props: LegacyProps) {
  const [Comp, setComp] = useState<ComponentType<LegacyProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@/components/auth/AuthLegacyClerkSignIn")
      .then((mod) => {
        if (!cancelled) setComp(() => mod.LegacyClerkSignIn);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <AuthGatewayFailCard isSignIn />;
  if (!Comp) return <AuthGatewaySkeleton label="جارٍ تحميل بوابة الدخول…" />;
  return <Comp {...props} />;
}
