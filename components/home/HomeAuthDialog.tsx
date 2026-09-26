"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { HomeAuthIdentifier } from "@/components/home/HomeAuthIdentifier";
import {
  armPendingAsk,
  completeHomeAuth,
  fetchHomeAuthUser,
  readHomeAuthIntent,
} from "@/components/home/home-auth-bus";
import type { HomeAuthDialogProps } from "@/components/home/HomeAuthLauncher";
import { buildOAuthStartPath } from "@/lib/modules/auth/clerk-oauth-start";
import { openOAuthPopup } from "@/lib/modules/auth/oauth-popup";
import { continueUrl, HOME_AUTH_RETURN_PATH } from "@/lib/modules/auth/safe-next";
import {
  lastAuthMethodCookie,
  parseLastAuthMethod,
  type HomeAuthIntent,
  type HomeAuthMethod,
} from "@/lib/modules/config/home-inline-auth";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** خطوات إدخال الرمز والبيانات: النقر خارج الحوار لا يغلقه (يمنع فقد ما كُتب). */
const STICKY_STEPS = new Set(["code", "second-factor", "profile", "finishing"]);

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

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1-.1 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.2zM14.5 6.2c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.7-1.3z" />
    </svg>
  );
}

type SocialProvider = "google" | "microsoft" | "apple";
const SOCIAL_LABEL: Record<SocialProvider, string> = {
  google: "المتابعة باستخدام Google",
  microsoft: "المتابعة باستخدام Microsoft",
  apple: "المتابعة باستخدام Apple",
};

/**
 * حوار الدخول في الصفحة الرئيسية — نافذة وسطى على الحاسب ولوح سفلي على الجوال.
 * WAI-ARIA APG (Dialog Modal): role=dialog + aria-modal + aria-labelledby، حبس التركيز
 * وإعادته، Esc وزر إغلاق، والنقر خارجًا (إلا أثناء إدخال الرمز)، وقفل تمرير الخلفية.
 * يبقى مركّبًا بعد أول فتح (مخفيًّا) كي لا يُعاد تحميل Clerk بين الفتحات.
 */
export function HomeAuthDialog({ config, request, onClose }: HomeAuthDialogProps) {
  const open = Boolean(request);
  const titleId = useId();
  const ledeId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [step, setStep] = useState("identifier");
  const [busyProvider, setBusyProvider] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [lastMethod, setLastMethod] = useState<HomeAuthMethod | null>(null);
  const [flowKey, setFlowKey] = useState(0);

  const intent: HomeAuthIntent = request?.intent ?? { kind: "login" };
  const mode = request?.mode ?? "sign-in";
  // الوجهة التي يقترحها الخادم عند التحويل الكامل — العودة إلى الرئيسية مع النيّة، أو الخدمة مباشرة
  const returnPath = intent.kind === "navigate" ? intent.next : HOME_AUTH_RETURN_PATH;
  const providers = config.providers;
  const social = (["google", "microsoft", "apple"] as const).filter((p) => providers.includes(p));
  const hasIdentifier = providers.includes("email") || providers.includes("phone");

  // فتح جديد: حالة نظيفة، وتركيز العنوان، وقفل التمرير
  useEffect(() => {
    if (!request) return;
    returnFocusRef.current =
      request.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setError("");
    setLive("");
    setBusyProvider(null);
    setFinishing(false);
    setStep("identifier");
    setFlowKey((k) => k + 1);
    setLastMethod(parseLastAuthMethod(document.cookie));
    document.body.classList.add("hk-scroll-locked");
    const id = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(id);
      document.body.classList.remove("hk-scroll-locked");
    };
  }, [request]);

  const close = useCallback(() => {
    onClose();
    const back = returnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (back && back.isConnected) back.focus();
      else document.getElementById("home-account-link")?.focus();
    });
  }, [onClose]);

  /** الجلسة ثبتت (hakeem_session): نحدّث الحالة وننفّذ النيّة دون إعادة تحميل. */
  const onAuthenticated = useCallback(
    async (method: HomeAuthMethod) => {
      document.cookie = lastAuthMethodCookie(method, window.location.protocol === "https:");
      setFinishing(true);
      setLive("تم تسجيل الدخول. جارٍ تحديث الصفحة…");
      const user = await fetchHomeAuthUser();
      const current = readHomeAuthIntent() ?? intent;
      if (!user) {
        // الجلسة لم تظهر لـ /api/auth/me — نكمل بالمسار الكامل المعتاد
        armPendingAsk(current);
        window.location.assign(continueUrl(current.kind === "navigate" ? current.next : HOME_AUTH_RETURN_PATH));
        return;
      }
      const navigating = completeHomeAuth(current, user);
      if (!navigating) {
        setLive("تم تسجيل الدخول.");
        close();
      }
    },
    [close, intent]
  );

  function startSocial(provider: SocialProvider, e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (busyProvider || finishing) return;
    setError("");
    setBusyProvider(provider);
    setLive(`جارٍ فتح نافذة ${provider === "google" ? "Google" : provider === "microsoft" ? "Microsoft" : "Apple"}…`);
    const fullHref = e.currentTarget.href;
    const popupUrl =
      provider === "google"
        ? `/api/auth/google?popup=1&next=${encodeURIComponent(returnPath)}`
        : `${buildOAuthStartPath({ provider, nextUrl: returnPath, mode })}&popup=1`;
    const opened = openOAuthPopup({
      url: popupUrl,
      title: `hakeem_${provider}_popup`,
      onSuccess: () => {
        setBusyProvider(null);
        void onAuthenticated(provider);
      },
      onError: () => {
        setBusyProvider(null);
        setLive("");
        setError("تعذّر إكمال الدخول. أعد المحاولة أو اختر وسيلة أخرى.");
      },
      onClose: () => {
        setBusyProvider(null);
        setLive("");
      },
    });
    if (!opened) {
      // النافذة محجوبة: تحويل كامل يعود إلى الرئيسية والنيّة محفوظة في sessionStorage
      armPendingAsk(intent);
      document.cookie = lastAuthMethodCookie(provider, window.location.protocol === "https:");
      window.location.assign(fullHref);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab" || !panelRef.current) return;
    const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === titleRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onBackdropMouseDown(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (STICKY_STEPS.has(step) || finishing) return;
    close();
  }

  const title = mode === "sign-up" ? "ابدأ مع حكيم" : "أهلًا بعودتك";
  const lede =
    intent.kind === "ask"
      ? "ادخل لنُكمل سؤالك هنا مباشرة — حسابك يُنشأ تلقائيًا إن كنت جديدًا."
      : "ادخل أو أنشئ حسابك دون مغادرة الصفحة.";
  const portalFallbackHref = `/api/auth/oauth/start?${new URLSearchParams({
    provider: providers.includes("email") ? "email" : "phone",
    mode,
    next: returnPath,
    portal: "1",
  })}`;

  return (
    <div
      className="hk-home-auth__backdrop hk-auth"
      hidden={!open}
      onMouseDown={onBackdropMouseDown}
      lang="ar"
      dir="rtl"
    >
      <div
        ref={panelRef}
        className="hk-home-auth__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={ledeId}
        onKeyDown={onKeyDown}
      >
        <button type="button" className="hk-home-auth__close" onClick={close} aria-label="إغلاق نافذة الدخول">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="hk-home-auth__title">
          {title}
        </h2>
        <p id={ledeId} className="hk-home-auth__lede">
          {lede}
        </p>

        <p className="sr-only" role="status" aria-live="polite">
          {live}
        </p>

        {error ? (
          <div className="mt-4 rounded-[0.5rem] border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold leading-5 text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        {step === "identifier" && social.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3">
            {social.map((p) => {
              const href =
                p === "google"
                  ? `/api/auth/google?next=${encodeURIComponent(returnPath)}`
                  : buildOAuthStartPath({ provider: p, nextUrl: returnPath, mode });
              return (
                <a
                  key={p}
                  href={href}
                  className="hk-home-auth__provider"
                  onClick={(e) => startSocial(p, e)}
                  aria-busy={busyProvider === p || undefined}
                >
                  {p === "google" ? <GoogleIcon /> : p === "microsoft" ? <MicrosoftIcon /> : <AppleIcon />}
                  <span>{busyProvider === p ? "جارٍ الانتظار في النافذة المفتوحة…" : SOCIAL_LABEL[p]}</span>
                  {lastMethod === p ? <span className="hk-home-auth__last">آخر ما استخدمته</span> : null}
                </a>
              );
            })}
          </div>
        ) : null}

        {step === "identifier" && social.length > 0 && hasIdentifier ? (
          <div className="hk-home-auth__divider mt-4" aria-hidden>
            أو
          </div>
        ) : null}

        {hasIdentifier ? (
          config.identifierForm ? (
            <div className={step === "identifier" ? "mt-3" : "mt-5"}>
              {lastMethod === "identifier" && step === "identifier" ? (
                <p className="mb-1 text-center">
                  <span className="hk-home-auth__last">آخر ما استخدمته: البريد أو الجوال</span>
                </p>
              ) : null}
              <HomeAuthIdentifier
                key={flowKey}
                config={config}
                mode={mode}
                nextUrl={intent.kind === "navigate" ? intent.next : "/dashboard"}
                portalFallbackHref={portalFallbackHref}
                onStepChange={setStep}
                onComplete={(result) => {
                  if (result.ok) {
                    void onAuthenticated("identifier");
                    return;
                  }
                  // تعذّر تثبيت hakeem_session: المسار المحمي يقرأ جلسة Clerk مباشرة (السلوك السابق)
                  armPendingAsk(intent);
                  window.location.assign(result.next);
                }}
              />
            </div>
          ) : (
            <a
              href={buildOAuthStartPath({
                provider: providers.includes("email") ? "email" : "phone",
                nextUrl: returnPath,
                mode,
              })}
              className="hk-home-auth__provider mt-3"
              onClick={() => armPendingAsk(intent)}
            >
              <span>المتابعة بالبريد الإلكتروني أو رقم الجوال</span>
            </a>
          )
        ) : null}

        {step === "identifier" ? (
          <p className="hk-home-auth__terms">
            باستمرارك، فإنك توافق على{" "}
            <a href="/terms" target="_blank" rel="noopener">
              شروط الاستخدام
            </a>{" "}
            و
            <a href="/privacy" target="_blank" rel="noopener">
              سياسة الخصوصية
            </a>
            .
          </p>
        ) : null}
      </div>
    </div>
  );
}
