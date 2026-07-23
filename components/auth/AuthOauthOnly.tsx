"use client";

import { useState } from "react";
import Link from "next/link";
import { useSignIn, useSignUp, useClerk } from "@clerk/nextjs";
import type { OAuthStrategy } from "@clerk/types";

import { continueUrl as sharedContinueUrl } from "@/lib/modules/auth/safe-next";

type AuthMode = "sign-in" | "sign-up";

const PROVIDERS: Array<{
  strategy: OAuthStrategy;
  label: string;
  aria: string;
}> = [
  { strategy: "oauth_google", label: "المتابعة باستخدام Google", aria: "الدخول عبر Google" },
  { strategy: "oauth_apple", label: "المتابعة باستخدام Apple", aria: "الدخول عبر Apple" },
];

function continueUrl(nextUrl: string) {
  return sharedContinueUrl(nextUrl);
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l.1.1 6.3 5.2C39.1 37.3 44 33 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1-.1 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.2zM14.5 6.2c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.7-1.3z" />
    </svg>
  );
}

function ProviderIcon({ strategy }: { strategy: OAuthStrategy }) {
  if (strategy === "oauth_google") return <GoogleIcon />;
  return <AppleIcon />;
}

function AuthCardSkeleton({ label }: { label: string }) {
  return (
    <div
      className="w-full max-w-[25rem] space-y-4 rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="mx-auto h-7 w-48 animate-pulse rounded bg-[#0E3435]/10" />
      <div className="mx-auto h-4 w-64 animate-pulse rounded bg-[#0E3435]/8" />
      <div className="mt-4 space-y-2.5">
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
        <div className="h-12 animate-pulse rounded-xl bg-[#0E3435]/8" />
      </div>
      <p className="pt-1 text-center text-sm text-[#0E3435]/55">{label}</p>
    </div>
  );
}

/**
 * بطاقة دخول/تسجيل مخصّصة — Google وApple فقط.
 * لا تستخدم مكوّن Clerk الجاهز حتى لا يظهر حقل البريد المضلل.
 */
export function AuthOauthOnly({
  mode,
  nextUrl = "/dashboard",
}: {
  mode: AuthMode;
  nextUrl?: string;
}) {
  const { loaded } = useClerk();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const [busy, setBusy] = useState<OAuthStrategy | null>(null);
  const [error, setError] = useState("");

  const ready = loaded && (mode === "sign-in" ? signInLoaded : signUpLoaded);
  const afterAuth = continueUrl(nextUrl);
  const isSignIn = mode === "sign-in";

  async function startOAuth(strategy: OAuthStrategy) {
    if (busy) return;
    setError("");
    setBusy(strategy);
    try {
      const redirectUrl = `${window.location.origin}/sso-callback`;
      if (isSignIn) {
        if (!signIn) throw new Error("تعذّر بدء الدخول.");
        await signIn.authenticateWithRedirect({
          strategy,
          redirectUrl,
          redirectUrlComplete: afterAuth,
        });
      } else {
        if (!signUp) throw new Error("تعذّر بدء إنشاء الحساب.");
        await signUp.authenticateWithRedirect({
          strategy,
          redirectUrl,
          redirectUrlComplete: afterAuth,
        });
      }
    } catch (err) {
      const message =
        err && typeof err === "object" && "errors" in err
          ? String((err as { errors?: Array<{ message?: string }> }).errors?.[0]?.message || "")
          : err instanceof Error
            ? err.message
            : "";
      setError(message || "تعذّر إكمال الدخول. حاول مرة أخرى.");
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <AuthCardSkeleton
        label={isSignIn ? "جارٍ تحميل تسجيل الدخول…" : "جارٍ تحميل إنشاء الحساب…"}
      />
    );
  }

  return (
    <div className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <header className="text-center">
        <h2 className="text-[1.35rem] font-semibold leading-8 text-[#0E3435]">
          {isSignIn ? "مرحبًا بعودتك إلى حكيم" : "إنشاء حساب في حكيم"}
        </h2>
        <p className="mt-2 text-[0.95rem] leading-7 text-[rgba(14,52,53,0.68)]">
          {isSignIn
            ? "تابع أعمالك القانونية وتقاريرك وخدماتك الذكية من مكان واحد"
            : "أنشئ حسابك عبر Google أو Apple وابدأ تجربتك في دقائق"}
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.strategy}
            type="button"
            aria-label={p.aria}
            aria-busy={busy === p.strategy}
            disabled={Boolean(busy)}
            onClick={() => void startOAuth(p.strategy)}
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[0.75rem] border border-[rgba(14,52,53,0.12)] bg-white px-4 text-[0.95rem] font-semibold text-[#0E3435] transition hover:bg-[#F7F2EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E3435]/35 disabled:cursor-wait disabled:opacity-60"
          >
            {busy === p.strategy ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0E3435]/25 border-t-[#0E3435]"
                aria-hidden
              />
            ) : (
              <ProviderIcon strategy={p.strategy} />
            )}
            <span>{busy === p.strategy ? "جارٍ التحويل…" : p.label}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-center text-sm leading-6 text-[#B42318]">
          {error}
        </p>
      ) : null}

      <p className="mt-5 text-center text-xs leading-6 text-[rgba(14,52,53,0.55)]">
        لا يتوفر الدخول بالبريد الإلكتروني. استخدم Google أو Apple للمتابعة.
        بياناتك محمية وفق سياسة الخصوصية.
      </p>

      <p className="mt-3 text-center text-sm">
        <Link href="/" className="font-semibold text-[rgba(14,52,53,0.65)] hover:text-[#0E3435]">
          العودة إلى الصفحة الرئيسية
        </Link>
      </p>

      <p className="mt-4 text-center text-sm text-[rgba(14,52,53,0.6)]">
        {isSignIn ? (
          <>
            مستخدم جديد؟{" "}
            <Link href="/sign-up" className="font-semibold text-[#8B6914] hover:text-[#0E3435]">
              أنشئ حسابك
            </Link>
          </>
        ) : (
          <>
            لديك حساب؟{" "}
            <Link href="/sign-in" className="font-semibold text-[#8B6914] hover:text-[#0E3435]">
              تسجيل الدخول
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
