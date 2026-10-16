"use client";

import { useMemo } from "react";
import { HomeAuthDialog } from "@/components/home/HomeAuthDialog";
import type { HomeAuthConfig } from "@/components/home/HomeAuthLauncher";
import type { HomeAuthOpenRequest } from "@/components/home/home-auth-bus";
import type { HomeAuthMode } from "@/lib/modules/config/home-inline-auth";

/**
 * صفحة الدخول الموحّدة (‎/sign-in‎): صندوق الرئيسية نفسه — Google، وتبويبا
 * «رقم الجوال | البريد الإلكتروني»، والرمز، ثم «تم التحقق» ← الصفحة الداخلية (‎next‎).
 */
export function SignInPagePanel({
  config,
  mode,
  nextUrl,
}: {
  config: HomeAuthConfig;
  mode: HomeAuthMode;
  nextUrl: string;
}) {
  const request = useMemo<HomeAuthOpenRequest>(
    () => ({ mode, intent: { kind: "navigate", next: nextUrl } }),
    [mode, nextUrl]
  );
  return <HomeAuthDialog variant="page" config={config} request={request} onClose={noop} />;
}

function noop() {}
