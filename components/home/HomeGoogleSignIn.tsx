"use client";

import { useState } from "react";
import { openOAuthPopup } from "@/lib/modules/auth/oauth-popup";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l.1.1 6.3 5.2C39.1 37.3 44 33 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

/**
 * دخول Google من الصفحة الرئيسية مباشرة — نافذة صغيرة ثم العودة للمنصة.
 * بدون المرور بصفحة /sign-in.
 */
export function HomeGoogleSignIn({
  nextUrl = "/dashboard",
  label = "المتابعة باستخدام Google",
  size = "md",
  className = "",
}: {
  nextUrl?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const googleHref = `/api/auth/google?next=${encodeURIComponent(nextUrl)}`;
  const sizeClass =
    size === "lg"
      ? "min-h-[48px] px-6 text-base"
      : size === "sm"
        ? "min-h-[40px] px-3 text-sm"
        : "min-h-[44px] px-4 text-sm";

  function handleGoogleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    const popupUrl = `/api/auth/google?popup=1&next=${encodeURIComponent(nextUrl)}`;
    const opened = openOAuthPopup({
      url: popupUrl,
      title: "google_login_popup",
      onSuccess: (payload) => {
        setLoading(false);
        window.location.href = payload.next || nextUrl || "/dashboard";
      },
      onError: () => {
        setLoading(false);
        setError("تعذّر تسجيل الدخول باستخدام Google. يُرجى المحاولة مجددًا.");
      },
      onClose: () => {
        setLoading(false);
      },
    });

    if (!opened) {
      window.location.href = googleHref;
    }
  }

  return (
    <div className={className}>
      <a
        href={googleHref}
        onClick={handleGoogleClick}
        aria-label={label}
        aria-busy={loading}
        className={`focus-ring inline-flex w-full items-center justify-center gap-2.5 rounded-[var(--r-md)] border border-[rgba(14,52,53,0.12)] bg-white font-semibold text-[var(--navy)] shadow-[0_1px_2px_rgba(14,52,53,0.06)] transition hover:bg-ivory ${sizeClass} ${
          loading ? "cursor-wait opacity-75" : ""
        }`}
      >
        {loading ? (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--navy)]/20 border-t-[var(--navy)]"
            aria-hidden
          />
        ) : (
          <GoogleMark />
        )}
        <span>{loading ? "جارٍ فتح Google…" : label}</span>
      </a>
      {error ? (
        <p className="mt-2 text-center text-xs font-semibold text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
