"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useClerkMounted } from "@/components/providers/ClerkAppProvider";
import { ClientErrorBoundary } from "@/components/providers/ClientErrorBoundary";

const AFTER_AUTH = "/auth/continue";
const FALLBACK_MS = 12_000;

type CallbackProps = {
  signInUrl: string;
  signUpUrl: string;
  continueSignUpUrl: string;
  signInFallbackRedirectUrl: string;
  signUpFallbackRedirectUrl: string;
};

/**
 * يكمل جلسة OAuth داخل نطاق التطبيق ويعود لـ /auth/continue.
 * AuthenticateWithRedirectCallback يُحمَّل ديناميكيًا بعد تركيب Clerk.
 */
export function SsoCallbackClient() {
  return (
    <ClientErrorBoundary
      fallback={
        <SsoMessage
          title="تعذّر إكمال تسجيل الدخول"
          body="حدث خطأ أثناء ربط الجلسة. أعد المحاولة من صفحة الدخول."
          showSignIn
        />
      }
    >
      <SsoCallbackBody />
    </ClientErrorBoundary>
  );
}

function SsoCallbackBody() {
  const clerkMounted = useClerkMounted();
  const [timedOut, setTimedOut] = useState(false);
  const [Callback, setCallback] = useState<ComponentType<CallbackProps> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!clerkMounted) return;
    let cancelled = false;
    import("@clerk/nextjs")
      .then((mod) => {
        if (!cancelled) {
          setCallback(() => mod.AuthenticateWithRedirectCallback as ComponentType<CallbackProps>);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [clerkMounted]);

  if (timedOut || loadFailed) {
    return (
      <SsoMessage
        title="تعذّر إكمال تسجيل الدخول"
        body="انتهت مهلة الربط مع مزوّد الدخول. أعد المحاولة من صفحة الدخول."
        showSignIn
      />
    );
  }

  if (!clerkMounted || !Callback) {
    return (
      <SsoMessage
        title="جارٍ تجهيز الجلسة…"
        body="لا تغلق هذه النافذة."
        spinning
      />
    );
  }

  return (
    <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      <div
        className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
        aria-hidden
      />
      <p className="mt-4 text-sm font-semibold text-[#0E3435]">جارٍ إكمال الدخول…</p>
      <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">لا تغلق هذه النافذة.</p>
      <Callback
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        continueSignUpUrl="/sign-up"
        signInFallbackRedirectUrl={AFTER_AUTH}
        signUpFallbackRedirectUrl={AFTER_AUTH}
      />
    </div>
  );
}

function SsoMessage({
  title,
  body,
  showSignIn,
  spinning,
}: {
  title: string;
  body: string;
  showSignIn?: boolean;
  spinning?: boolean;
}) {
  return (
    <div className="w-full max-w-sm rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-8 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)]">
      {spinning ? (
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
          aria-hidden
        />
      ) : null}
      <p className={`text-sm font-semibold text-[#0E3435]${spinning ? " mt-4" : ""}`}>{title}</p>
      <p className="mt-2 text-xs leading-6 text-[rgba(14,52,53,0.55)]">{body}</p>
      {showSignIn ? (
        <Link
          href="/#login"
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-[0.75rem] bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7] hover:bg-[#164849]"
        >
          العودة لتسجيل الدخول
        </Link>
      ) : null}
    </div>
  );
}
