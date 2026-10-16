"use client";

import { useState } from "react";
import { buildOAuthStartPath } from "@/lib/modules/auth/clerk-oauth-start";
import {
  listVisibleAuthProviders,
  type VisibleAuthProvider,
} from "@/lib/modules/auth/auth-providers";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { openOAuthPopup } from "@/lib/modules/auth/oauth-popup";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
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

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1-.1 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.2zM14.5 6.2c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.7-1.3z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

function IdentifierIcon({ phoneOnly }: { phoneOnly: boolean }) {
  return phoneOnly ? (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
      <path d="M11 18.5h2" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

/** نص زر البريد/الجوال — بوابة Clerk تعرض الحقول المفعّلة فعليًا. */
function identifierLabel(email: boolean, phone: boolean): string {
  if (email && phone) return "المتابعة بالبريد الإلكتروني أو رقم الجوال";
  if (phone) return "المتابعة برقم الجوال";
  return "المتابعة بالبريد الإلكتروني";
}

const providerButtonClass =
  "flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[0.75rem] border border-[var(--auth-input-border)] bg-white px-4 text-[0.95rem] font-semibold text-[#0E3435] transition hover:bg-[#F7F2EA]";

/** رابط داخل النص بهدف لمس لا يقل عن 44px (WCAG 2.5.5). */
const inlineLinkClass = "inline-flex min-h-[44px] items-center underline-offset-2 hover:underline";

function ButtonSpinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#0E3435]/20 border-t-[#0E3435]"
      aria-hidden
    />
  );
}

/**
 * أزرار دخول SSR مع دعم التوثيق عبر نافذة منبثقة تفاعلية (Popup Window).
 * Google يفضّل المسار الأصلي (/api/auth/google → hakeem_session) عند توفّر المفاتيح.
 * Microsoft وApple والبريد والجوال مخفية حتى تُفعَّل أعلامها (راجع auth-providers.ts).
 * البريد والجوال يفتحان صفحة بوابة Clerk: رمز تحقق ثم التحقق الثنائي إن فعّله المستخدم.
 */
export function AuthOauthButtons({
  mode,
  nextUrl = "/dashboard",
  id,
  className = "",
  embedded = false,
  visibleProviders,
}: {
  mode: "sign-in" | "sign-up";
  nextUrl?: string;
  id?: string;
  className?: string;
  /** مكوّن مدمج (Rollback فقط) — الصفحة الرئيسية لا تستخدمه. */
  embedded?: boolean;
  visibleProviders?: VisibleAuthProvider[];
}) {
  const isSignIn = mode === "sign-in";
  const providers = visibleProviders ?? listVisibleAuthProviders();
  const showGoogle = providers.includes("google");
  const showApple = providers.includes("apple");
  const showMicrosoft = providers.includes("microsoft");
  const showEmail = providers.includes("email");
  const showPhone = providers.includes("phone");
  const showIdentifier = showEmail || showPhone;
  const hasSocial = showGoogle || showApple || showMicrosoft;
  // دائمًا /api/auth/google: يُحمّل المفاتيح من الإعدادات وقت الطلب،
  // ثم يحوّل لـ Clerk فقط إن لم تتوفر مفاتيح Google الأصلية.
  const googleHref = `/api/auth/google?next=${encodeURIComponent(nextUrl)}`;
  const appleHref = buildOAuthStartPath({ provider: "apple", nextUrl, mode });
  const microsoftHref = buildOAuthStartPath({ provider: "microsoft", nextUrl, mode });
  const identifierHref = buildOAuthStartPath({
    provider: showEmail ? "email" : "phone",
    nextUrl,
    mode,
  });
  const googleNativePreferred = isGoogleOAuthConfigured();

  const [loadingProvider, setLoadingProvider] = useState<"google" | "apple" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  function handleGoogleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (loadingProvider) return;

    setLoadingProvider("google");
    setErrorMessage("");

    const popupUrl = `/api/auth/google?popup=1&next=${encodeURIComponent(nextUrl)}`;
    const opened = openOAuthPopup({
      url: popupUrl,
      title: "google_login_popup",
      onSuccess: (payload) => {
        setLoadingProvider(null);
        window.location.href = payload.next || nextUrl || "/dashboard";
      },
      onError: () => {
        setLoadingProvider(null);
        setErrorMessage("تعذّر تسجيل الدخول باستخدام Google. يُرجى المحاولة مجددًا.");
      },
      onClose: () => {
        setLoadingProvider(null);
      },
    });

    if (!opened) {
      // تم حظر النوافذ المنبثقة من قبل المتصفح — الانتقال للصفحة بالكامل كبديل تلقائي
      window.location.href = googleHref;
    }
  }

  if (!hasSocial && !showIdentifier) {
    return (
      <div
        id={id}
        className={`w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 text-center shadow-[0_8px_30px_rgba(14,52,53,0.06)] ${className}`.trim()}
        role="alert"
      >
        <p className="text-sm font-semibold text-[#0E3435]">
          تعذّر تحميل بوابة الدخول. أعد المحاولة أو عد إلى الصفحة الرئيسية.
        </p>
        <p className="mt-4">
          <a href="/" className={`${inlineLinkClass} text-sm font-semibold text-[var(--auth-muted)] hover:text-[#0E3435]`}>
            العودة إلى الصفحة الرئيسية
          </a>
        </p>
      </div>
    );
  }

  return (
    <div
      id={id}
      data-google-native={googleNativePreferred ? "1" : "0"}
      className={`w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)] ${className}`.trim()}
    >
      <header className="text-center">
        <h2 className="text-[1.35rem] font-semibold leading-8 text-[#0E3435]">
          {embedded
            ? "سجّل الدخول إلى حكيم"
            : isSignIn
              ? "مرحبًا بعودتك إلى حكيم"
              : "إنشاء حساب في حكيم"}
        </h2>
        <p className="mt-2 text-[0.95rem] leading-7 text-[var(--auth-muted)]">
          {embedded
            ? "المتابعة عبر وسيلة الدخول المفعّلة — للحساب الجديد والقائم"
            : isSignIn
              ? "تابع أعمالك القانونية وتقاريرك وخدماتك الذكية من مكان واحد"
              : "أنشئ حسابك وابدأ تجربتك المجانية في دقائق"}
        </p>
      </header>

      {errorMessage ? (
        <div
          className="mt-4 rounded-[0.5rem] border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold leading-5 text-red-700"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {showGoogle ? (
          <a
            href={googleHref}
            onClick={handleGoogleClick}
            aria-label="المتابعة باستخدام Google"
            aria-busy={loadingProvider === "google"}
            className={`flex min-h-[48px] w-full items-center justify-center gap-3 rounded-[0.75rem] border border-[var(--auth-input-border)] bg-white px-4 text-[0.95rem] font-semibold text-[#0E3435] transition hover:bg-[#F7F2EA] ${
              loadingProvider === "google" ? "opacity-75 cursor-wait" : ""
            }`}
          >
            {loadingProvider === "google" ? <ButtonSpinner /> : <GoogleIcon />}
            <span>
              {loadingProvider === "google"
                ? "جارٍ تسجيل الدخول عبر Google..."
                : "المتابعة باستخدام Google"}
            </span>
          </a>
        ) : null}

        {showMicrosoft ? (
          <a href={microsoftHref} aria-label="المتابعة باستخدام Microsoft" className={providerButtonClass}>
            <MicrosoftIcon />
            <span>المتابعة باستخدام Microsoft</span>
          </a>
        ) : null}

        {showApple ? (
          <a href={appleHref} aria-label="المتابعة باستخدام Apple" className={providerButtonClass}>
            <AppleIcon />
            <span>المتابعة باستخدام Apple</span>
          </a>
        ) : null}

        {showIdentifier && hasSocial ? (
          <div className="flex items-center gap-3 text-xs text-[var(--auth-muted)]" aria-hidden>
            <span className="h-px flex-1 bg-[rgba(14,52,53,0.12)]" />
            <span>أو</span>
            <span className="h-px flex-1 bg-[rgba(14,52,53,0.12)]" />
          </div>
        ) : null}

        {showIdentifier ? (
          <a
            href={identifierHref}
            aria-label={identifierLabel(showEmail, showPhone)}
            className={providerButtonClass}
          >
            <IdentifierIcon phoneOnly={showPhone && !showEmail} />
            <span>{identifierLabel(showEmail, showPhone)}</span>
          </a>
        ) : null}
      </div>

      <p className="mt-5 text-center text-xs leading-6 text-[var(--auth-muted)]">
        باستمرارك، فإنك توافق على{" "}
        <a href="/terms" className={inlineLinkClass}>
          شروط الاستخدام
        </a>{" "}
        و
        <a href="/privacy" className={inlineLinkClass}>
          سياسة الخصوصية
        </a>
        .
      </p>

      {!embedded ? (
        <>
          <p className="mt-3 text-center text-sm">
            <a href="/" className={`${inlineLinkClass} font-semibold text-[var(--auth-muted)] hover:text-[#0E3435]`}>
              العودة إلى الصفحة الرئيسية
            </a>
          </p>
          <p className="mt-2 text-center text-sm text-[var(--auth-muted)]">
            {isSignIn ? (
              <>
                مستخدم جديد؟{" "}
                <a href="/sign-up" className={`${inlineLinkClass} font-semibold text-[#8B6914] hover:text-[#0E3435]`}>
                  أنشئ حسابك
                </a>
              </>
            ) : (
              <>
                لديك حساب؟{" "}
                <a href="/sign-in" className={`${inlineLinkClass} font-semibold text-[#8B6914] hover:text-[#0E3435]`}>
                  تسجيل الدخول
                </a>
              </>
            )}
          </p>
        </>
      ) : null}
    </div>
  );
}

