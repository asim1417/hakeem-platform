"use client";

import { AuthOauthOnly } from "@/components/auth/AuthOauthOnly";

/** إنشاء حساب — Google وApple فقط، بلا حقل بريد. */
export function AuthClerkSignUp({
  forceRedirectUrl = "/auth/continue?next=%2Fdashboard",
}: {
  forceRedirectUrl?: string;
  signInUrl?: string;
}) {
  let nextUrl = "/dashboard";
  try {
    const q = forceRedirectUrl.includes("?") ? forceRedirectUrl.split("?")[1] : "";
    const next = new URLSearchParams(q).get("next");
    if (next && next.startsWith("/") && !next.startsWith("//")) nextUrl = next;
  } catch {
    nextUrl = "/dashboard";
  }
  return <AuthOauthOnly mode="sign-up" nextUrl={nextUrl} />;
}
