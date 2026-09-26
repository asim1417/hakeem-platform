"use client";

import { useCallback, useEffect, useState, type ComponentProps, type ComponentType, type FormEvent } from "react";
import { ClerkAppProvider, useClerkMounted } from "@/components/providers/ClerkAppProvider";
import type { HomeAuthConfig } from "@/components/home/HomeAuthLauncher";
import type {
  AuthIdentifierFlowInner,
  IdentifierFlowResult,
  IdentifierFlowStep,
} from "@/components/auth/AuthIdentifierFlowInner";
import type { HomeAuthMode } from "@/lib/modules/config/home-inline-auth";

type InnerComponent = ComponentType<ComponentProps<typeof AuthIdentifierFlowInner>>;

type Props = {
  config: HomeAuthConfig;
  mode: HomeAuthMode;
  nextUrl: string;
  portalFallbackHref: string;
  onStepChange: (step: IdentifierFlowStep) => void;
  onComplete: (result: IdentifierFlowResult) => void;
};

const inputClass =
  "block min-h-[48px] w-full rounded-[0.75rem] border border-[var(--auth-input-border)] bg-white px-4 text-[1rem] text-[#0E3435] transition focus:border-[#0E3435]";
const primaryButtonClass =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[0.75rem] bg-[#0E3435] px-4 text-[0.95rem] font-semibold text-[#FFFcf7] transition hover:bg-[#0E3435]/90 disabled:cursor-wait disabled:opacity-70";

/**
 * حقل «البريد أو رقم الجوال» في الحوار. أول رسم بلا Clerk:
 * عند أول تركيز أو كتابة يُركَّب ClerkAppProvider (تحميل ديناميكي) ثم النموذج العربي المضمّن،
 * مع الحفاظ على ما كُتب وعلى ضغطة «متابعة» إن سبقت الجاهزية.
 */
export function HomeAuthIdentifier(props: Props) {
  const [activated, setActivated] = useState(false);
  const [value, setValue] = useState("");
  const [queued, setQueued] = useState(false);
  const [innerReady, setInnerReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const onReady = useCallback(() => setInnerReady(true), []);
  const onFailed = useCallback(() => setFailed(true), []);

  // الحقل الخفيف خارج ClerkAppProvider عمدًا: تبديل المزوّد داخليًا يعيد تركيب أبنائه،
  // فيبقى الحقل ثابتًا (والتركيز فيه) حتى يجهز النموذج المضمّن فيحلّ محله.
  return (
    <>
      {!innerReady ? (
        <PlaceholderForm
          value={value}
          busy={queued}
          onValue={(v) => {
            setValue(v);
            setActivated(true);
          }}
          onFocus={() => setActivated(true)}
          onSubmit={() => {
            setActivated(true);
            if (value.trim()) setQueued(true);
          }}
        />
      ) : null}
      {failed && !innerReady ? (
        <div className="mt-3 rounded-[0.5rem] border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold leading-5 text-red-700" role="alert">
          تأخّر تجهيز الدخول الآمن.
          <a href={props.portalFallbackHref} className="inline-flex min-h-[44px] items-center justify-center underline">
            المتابعة عبر صفحة الدخول البديلة
          </a>
        </div>
      ) : null}
      {activated ? (
        <ClerkAppProvider
          publishableKey={props.config.publishableKey || undefined}
          hideDevelopmentMode={props.config.hideDevelopmentMode}
        >
          <EmbeddedFlow
            {...props}
            value={value}
            queued={queued}
            onReady={onReady}
            onFailed={onFailed}
          />
        </ClerkAppProvider>
      ) : null}
    </>
  );
}

function EmbeddedFlow({
  mode,
  nextUrl,
  portalFallbackHref,
  onStepChange,
  onComplete,
  value,
  queued,
  onReady,
  onFailed,
}: Props & { value: string; queued: boolean; onReady: () => void; onFailed: () => void }) {
  const mounted = useClerkMounted();
  const [Inner, setInner] = useState<InnerComponent | null>(null);
  // قيمة الحقل لحظة الجاهزية — لا نعيد ضبط النموذج بعدها مع كل حرف
  const [initial, setInitial] = useState<{ value: string; queued: boolean } | null>(null);

  useEffect(() => {
    if (mounted) return;
    const id = window.setTimeout(onFailed, 12000);
    return () => window.clearTimeout(id);
  }, [mounted, onFailed]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    import("@/components/auth/AuthIdentifierFlowInner")
      .then((mod) => {
        if (cancelled) return;
        setInner(() => mod.AuthIdentifierFlowInner as InnerComponent);
      })
      .catch(() => {
        if (!cancelled) onFailed();
      });
    return () => {
      cancelled = true;
    };
  }, [mounted, onFailed]);

  useEffect(() => {
    if (!Inner || initial) return;
    setInitial({ value, queued });
    onReady();
  }, [Inner, initial, value, queued, onReady]);

  if (!Inner || !initial) return null;
  return (
    <Inner
      mode={mode}
      nextUrl={nextUrl}
      portalFallbackHref={portalFallbackHref}
      embedded
      onComplete={onComplete}
      onStepChange={onStepChange}
      initialIdentifier={initial.value}
      submitOnReady={initial.queued}
    />
  );
}

/** نسخة خفيفة مطابقة لخطوة المعرّف في النموذج — بلا Clerk. */
function PlaceholderForm({
  value,
  busy,
  onValue,
  onFocus,
  onSubmit,
}: {
  value: string;
  busy: boolean;
  onValue: (v: string) => void;
  onFocus: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="mt-4 flex flex-col gap-3"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p id="hakeem-auth-required" className="hk-auth-required-note">
        الحقول المعلّمة بـ <span aria-hidden>*</span>
        <span className="sr-only">نجمة</span> مطلوبة.
      </p>
      <label htmlFor="hakeem-identifier" className="text-sm font-semibold text-[#0E3435]">
        البريد أو رقم الجوال
        <span className="hk-auth-required-mark" aria-hidden>
          *
        </span>
      </label>
      <input
        id="hakeem-identifier"
        className={inputClass}
        dir="ltr"
        type="text"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="05XXXXXXXX أو name@example.com"
        value={value}
        onChange={(e) => onValue(e.target.value)}
        onFocus={onFocus}
        required
        aria-required="true"
        aria-describedby="hakeem-auth-required"
      />
      <button type="submit" className={primaryButtonClass} disabled={busy} aria-busy={busy}>
        {busy ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#FFFcf7]/30 border-t-[#FFFcf7]" aria-hidden />
        ) : null}
        <span>{busy ? "لحظة…" : "متابعة"}</span>
      </button>
    </form>
  );
}
