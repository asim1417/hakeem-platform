"use client";

import "./home-auth.css";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { HomeAuthIdentifier } from "@/components/home/HomeAuthIdentifier";
import { armPendingAsk, completeHomeAuth, destinationFor, readHomeAuthIntent } from "@/components/home/home-auth-bus";
import type { HomeAuthDialogProps } from "@/components/home/HomeAuthLauncher";
import { buildOAuthStartPath } from "@/lib/modules/auth/clerk-oauth-start";
import { openOAuthPopup } from "@/lib/modules/auth/oauth-popup";
import {
  lastAuthMethodCookie,
  parseLastAuthMethod,
  type HomeAuthIntent,
  type HomeAuthMethod,
} from "@/lib/modules/config/home-inline-auth";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** خطوات إدخال الرمز والبيانات: النقر خارج الحوار لا يغلقه (يمنع فقد ما كُتب). */
const STICKY_STEPS = new Set(["code", "second-factor", "profile", "finishing", "finishing-failed"]);

/** مدة شاشة «تم التحقق» قبل الانتقال (الشاشة ٧). */
export const VERIFIED_HOLD_MS = 600;

type SocialProvider = "google" | "microsoft" | "apple";
type View = { name: "options" } | { name: "waiting"; provider: SocialProvider } | { name: "verified" };

const PROVIDER_NAME: Record<SocialProvider, string> = { google: "Google", microsoft: "Microsoft", apple: "Apple" };

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MicrosoftIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden>
      <rect x="0" y="0" width="10" height="10" fill="#F25022" />
      <rect x="11" y="0" width="10" height="10" fill="#7FBA00" />
      <rect x="0" y="11" width="10" height="10" fill="#00A4EF" />
      <rect x="11" y="11" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1-.1 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.2zM14.5 6.2c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.7-1.3z" />
    </svg>
  );
}

function ProviderIcon({ provider, size }: { provider: SocialProvider; size?: number }) {
  if (provider === "google") return <GoogleIcon size={size} />;
  if (provider === "microsoft") return <MicrosoftIcon size={size} />;
  return <AppleIcon size={size} />;
}

function Spinner() {
  return <span className="hk-spinner" aria-hidden />;
}

/** وسم «آخر دخول» فوق زر الوسيلة المستعملة آخر مرة (الشاشة ١) — من كوكي غير حساس. */
function LastBadge() {
  return <span className="hk-last">آخر دخول</span>;
}

/**
 * صندوق الدخول فوق الرئيسية — الشاشات المعتمدة ١–٧:
 * الخيارات ← (نافذة Google/Microsoft | الجوال/البريد برمز) ← تم التحقق ← انتقال واحد إلى الوجهة.
 * لوح سفلي على الجوال، وصندوق 440px على سطح المكتب.
 * WAI-ARIA APG (Dialog Modal): role=dialog + aria-modal + aria-labelledby، حبس التركيز وإعادته،
 * Esc وزر إغلاق، والنقر خارجًا (إلا أثناء إدخال الرمز)، وقفل تمرير الخلفية.
 */
export function HomeAuthDialog({ config, request, onClose, variant = "dialog" }: HomeAuthDialogProps) {
  // page: صفحة ‎/sign-in‎ — الصندوق نفسه بلا خلفية معتمة ولا إغلاق ولا حبس تركيز
  const page = variant === "page";
  const TitleTag = page ? "h1" : "h2";
  const router = useRouter();
  const open = Boolean(request);
  const titleId = useId();
  const ledeId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const prefetchedRef = useRef("");
  const [view, setView] = useState<View>({ name: "options" });
  const [step, setStep] = useState("identifier");
  const [error, setError] = useState("");
  const [lastMethod, setLastMethod] = useState<HomeAuthMethod | null>(null);
  const [flowKey, setFlowKey] = useState(0);

  const intent = useMemo<HomeAuthIntent>(() => request?.intent ?? { kind: "login" }, [request]);
  const mode = request?.mode ?? "sign-in";
  const destination = destinationFor(intent);
  const providers = config.providers;
  const social = (["google", "microsoft", "apple"] as const).filter((p) => providers.includes(p));
  const hasIdentifier = providers.includes("email") || providers.includes("phone");

  // فتح جديد: حالة نظيفة، وتركيز العنوان، وقفل التمرير
  useEffect(() => {
    if (!request) return;
    returnFocusRef.current =
      request.trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setError("");
    setView({ name: "options" });
    setStep("identifier");
    setFlowKey((k) => k + 1);
    setLastMethod(parseLastAuthMethod(document.cookie));
    if (page) return;
    document.body.classList.add("hk-scroll-locked");
    const id = window.requestAnimationFrame(() => titleRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(id);
      document.body.classList.remove("hk-scroll-locked");
    };
  }, [request, page]);

  /** تحميل مسبق للوجهة أثناء كتابة الرمز أو انتظار النافذة — فالانتقال بلا شاشة بيضاء. */
  const prefetchDestination = useCallback(() => {
    if (prefetchedRef.current === destination) return;
    prefetchedRef.current = destination;
    try {
      router.prefetch(destination);
    } catch {
      /* التحميل المسبق تحسين فقط */
    }
  }, [destination, router]);

  useEffect(() => {
    if (view.name === "waiting" || step === "code" || step === "second-factor") prefetchDestination();
  }, [view, step, prefetchDestination]);

  const close = useCallback(() => {
    onClose();
    const back = returnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (back && back.isConnected) back.focus();
    });
  }, [onClose]);

  /**
   * الجلسة ثبتت (hakeem_session): «تم التحقق» ~600ms ثم انتقال كامل واحد إلى الداخلية.
   * لا نستخدم soft navigation (router.push): كوكي الجلسة يُثبَّت عبر fetch؛ الانتقال الكامل
   * يضمن أن /dashboard يقرأ hakeem_session ولا يُعاد الزائر للرئيسية.
   * preferredNext من claim-clerk-session إن وُجد (سوبر → /admin، أو next محفوظ).
   */
  const onAuthenticated = useCallback(
    (method: HomeAuthMethod, preferredNext?: string) => {
      document.cookie = lastAuthMethodCookie(method, window.location.protocol === "https:");
      // الصفحة: الوجهة من ‎?next=‎ فقط — لا نية محفوظة قديمة من الرئيسية
      const current = page ? intent : readHomeAuthIntent() ?? intent;
      const fromIntent = completeHomeAuth(current);
      const dest =
        preferredNext && preferredNext.startsWith("/") && !preferredNext.startsWith("//")
          ? preferredNext
          : fromIntent;
      setView({ name: "verified" });
      window.setTimeout(() => {
        window.location.assign(dest);
      }, VERIFIED_HOLD_MS);
    },
    [intent, page]
  );

  const openPopup = useCallback(
    (provider: SocialProvider, fullHref: string) => {
      setError("");
      const popupUrl =
        provider === "google"
          ? `/api/auth/google?popup=1&next=${encodeURIComponent(destination)}`
          : `${buildOAuthStartPath({ provider, nextUrl: destination, mode })}&popup=1`;
      const opened = openOAuthPopup({
        url: popupUrl,
        title: `hakeem_${provider}_popup`,
        onSuccess: () => onAuthenticated(provider),
        onError: () => {
          setView({ name: "options" });
          setError("تعذّر إكمال الدخول. أعد المحاولة أو اختر وسيلة أخرى.");
        },
        onClose: () => {
          // أُغلقت النافذة دون رسالة: ربما اكتمل الدخول فعلًا — نتحقق من الجلسة قبل اعتباره إلغاءً
          void fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((data: { user?: { id?: string } | null; isGuest?: boolean } | null) => {
              if (data?.user?.id && !data.isGuest) onAuthenticated(provider);
            })
            .catch(() => undefined);
        },
      });
      if (!opened) {
        // النافذة محجوبة: انتقال احتياطي كامل إلى الوجهة نفسها، والنية محفوظة
        armPendingAsk(intent);
        document.cookie = lastAuthMethodCookie(provider, window.location.protocol === "https:");
        window.location.assign(fullHref);
        return;
      }
      setView({ name: "waiting", provider });
    },
    [destination, intent, mode, onAuthenticated]
  );

  function onSocialClick(provider: SocialProvider, e: MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (view.name !== "options") return;
    openPopup(provider, e.currentTarget.href);
  }

  function socialHref(p: SocialProvider) {
    return p === "google"
      ? `/api/auth/google?next=${encodeURIComponent(destination)}`
      : buildOAuthStartPath({ provider: p, nextUrl: destination, mode });
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (page) return;
    if (e.key === "Escape") {
      e.stopPropagation();
      if (view.name !== "verified") close();
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
    if (STICKY_STEPS.has(step) || view.name !== "options") return;
    close();
  }

  const title = mode === "sign-up" ? "ابدأ مع حكيم" : "أهلًا بعودتك";
  const portalFallbackHref = `/api/auth/oauth/start?${new URLSearchParams({
    provider: providers.includes("email") ? "email" : "phone",
    mode,
    next: destination,
    portal: "1",
  })}`;
  // الخطوة داخل النموذج (الرمز/البيانات) تملك عنوان الحوار وزر «رجوع»
  const flowOwnsHeader = view.name === "options" && step !== "identifier" && step !== "finishing";
  // «تم التحقق» فقط بعد تثبيت hakeem_session فعلًا؛ قبله (خطوة finishing) حالة انتظار محايدة
  const confirmed = view.name === "verified";
  const showVerified = confirmed || step === "finishing";

  const closeButton = page ? null : (
    <button type="button" className="hk-icon-btn hk-home-auth__close" onClick={close} aria-label="إغلاق">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );

  const optionsVisible = view.name === "options" && !showVerified;
  let overlay: ReactNode = null;
  if (showVerified && !confirmed) {
    // التحقق من الرمز تمّ عند Clerk، والجلسة تُثبَّت الآن — لا نعلن النجاح قبل تأكيد الخادم
    overlay = (
      <div className="hk-verified">
        <div className="hk-verified__mark" aria-hidden>
          <span className="hk-spinner hk-spinner--light" />
        </div>
        <div role="status" aria-live="polite" className="hk-verified__text">
          <TitleTag id={titleId} ref={titleRef} tabIndex={-1} className="hk-verified__title">
            جارٍ إكمال الدخول…
          </TitleTag>
        </div>
      </div>
    );
  } else if (showVerified) {
    // الشاشة ٧: تم التحقق ← جارٍ فتح الوجهة
    overlay = (
      <div className="hk-verified">
        <div className="hk-verified__mark" aria-hidden>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </div>
        <div role="status" aria-live="polite" className="hk-verified__text">
          <TitleTag id={titleId} ref={titleRef} tabIndex={-1} className="hk-verified__title">
            تم التحقق
          </TitleTag>
          <p className="hk-verified__sub">
            {destination === "/dashboard" ? "جارٍ فتح مساحة عملك…" : "جارٍ فتح الخدمة…"}
          </p>
        </div>
        <div className="hk-verified__bar" aria-hidden>
          <span />
        </div>
      </div>
    );
  } else if (view.name === "waiting") {
    // الشاشة ٥: أكمل الدخول في نافذة Google/Microsoft
    const name = PROVIDER_NAME[view.provider];
    overlay = (
      <>
        <div className="hk-home-auth__top hk-home-auth__top--end">{closeButton}</div>
        <div className="hk-center-icon hk-center-icon--provider">
          <ProviderIcon provider={view.provider} size={32} />
        </div>
        <div className="hk-center-text">
          <TitleTag id={titleId} ref={titleRef} tabIndex={-1} className="hk-home-auth__title">
            أكمل الدخول في نافذة {name}
          </TitleTag>
          <p className="hk-home-auth__lede">اختر حسابك في النافذة الصغيرة، وستُغلق وحدها وتعود إلى هنا.</p>
        </div>
        <div className="hk-wait" aria-live="polite">
          <Spinner />
          <span>بانتظار اختيار الحساب…</span>
        </div>
        <button type="button" className="hk-btn-outline" onClick={() => openPopup(view.provider, socialHref(view.provider))}>
          لم تظهر النافذة؟ افتحها مجددًا
        </button>
        <button type="button" className="hk-link44 self-center" onClick={() => setView({ name: "options" })}>
          اختيار وسيلة أخرى
        </button>
      </>
    );
  }
  // الشاشة ١ (وخطوات النموذج ٢ و٣ و٦ داخله) — مركّبة دائمًا كي لا يضيع ما كُتب ولا يُقطع تثبيت الجلسة
  const optionsBody = (
      <>
        {!optionsVisible ? null : flowOwnsHeader ? (
          <div className="hk-home-auth__top hk-home-auth__top--end">{closeButton}</div>
        ) : (
          <>
            <div className="hk-home-auth__top">
              <TitleTag id={titleId} ref={titleRef} tabIndex={-1} className="hk-home-auth__title">
                {title}
              </TitleTag>
              {closeButton}
            </div>
            <p id={ledeId} className="hk-home-auth__lede hk-home-auth__lede--tight">
              حساب واحد لكل خدماتك القانونية، ويُنشأ تلقائيًا إن كنت جديدًا.
            </p>
          </>
        )}

        {error ? (
          <div className="hk-err" role="alert">
            <span>{error}</span>
          </div>
        ) : null}

        {!flowOwnsHeader && social.length > 0 ? (
          <div className="hk-home-auth__providers">
            {social.map((p) => (
              <div key={p} className="hk-home-auth__provider-wrap">
                {lastMethod === p ? <LastBadge /> : null}
                <a href={socialHref(p)} className="hk-provider" onClick={(e) => onSocialClick(p, e)}>
                  <ProviderIcon provider={p} />
                  <span>المتابعة باستخدام {PROVIDER_NAME[p]}</span>
                </a>
              </div>
            ))}
          </div>
        ) : null}

        {!flowOwnsHeader && social.length > 0 && hasIdentifier ? (
          <div className="hk-divider" aria-hidden>
            <span>أو</span>
          </div>
        ) : null}

        {hasIdentifier ? (
          config.identifierForm ? (
            <HomeAuthIdentifier
              key={flowKey}
              config={config}
              mode={mode}
              nextUrl={destination}
              portalFallbackHref={portalFallbackHref}
              headingId={titleId}
              badge={lastMethod === "identifier" ? <LastBadge /> : null}
              onStepChange={setStep}
              onComplete={(result) => {
                // المضمّن يستدعي onComplete بعد التثبيت فقط؛ الفشل يبقى داخل النموذج برسالة واضحة
                // result.next من الخادم يربط الرئيسية بالداخلية (/dashboard أو /admin)
                if (result.ok) onAuthenticated("identifier", result.next);
              }}
            />
          ) : (
            <a
              href={buildOAuthStartPath({
                provider: providers.includes("email") ? "email" : "phone",
                nextUrl: destination,
                mode,
              })}
              className="hk-provider"
              onClick={() => armPendingAsk(intent)}
            >
              <span>المتابعة بالبريد الإلكتروني أو رقم الجوال</span>
            </a>
          )
        ) : null}

        {!flowOwnsHeader ? (
          <p className="hk-home-auth__terms">
            باستمرارك توافق على{" "}
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
      </>
  );

  if (page) {
    return (
      <section
        ref={panelRef}
        className="hk-auth hk-home-auth__panel hk-home-auth__panel--page"
        data-view={showVerified ? "verified" : view.name}
        aria-labelledby={titleId}
        lang="ar"
        dir="rtl"
      >
        {overlay}
        <div className="hk-home-auth__stack" hidden={!optionsVisible}>
          {optionsBody}
        </div>
      </section>
    );
  }

  return (
    <div className="hk-home-auth__backdrop hk-auth" hidden={!open} onMouseDown={onBackdropMouseDown} lang="ar" dir="rtl">
      <div
        ref={panelRef}
        className="hk-home-auth__panel"
        data-view={showVerified ? "verified" : view.name}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={optionsVisible && !flowOwnsHeader ? ledeId : undefined}
        onKeyDown={onKeyDown}
      >
        {overlay}
        {/* النموذج يبقى مركّبًا (مخفيًّا) أثناء انتظار النافذة و«تم التحقق» ليُكمل تثبيت الجلسة */}
        <div className="hk-home-auth__stack" hidden={!optionsVisible}>
          {optionsBody}
        </div>
      </div>
    </div>
  );
}
