"use client";

import { AuthOauthOnly } from "@/components/auth/AuthOauthOnly";

/** تسجيل الدخول — Google وApple فقط، بلا حقل بريد. */
export function AuthClerkSignIn({
  nextUrl,
}: {
  nextUrl: string;
  routing?: "path" | "hash";
  path?: string;
  signUpUrl?: string;
}) {
  return <AuthOauthOnly mode="sign-in" nextUrl={nextUrl} />;
}
