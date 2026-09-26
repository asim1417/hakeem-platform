"use client";

import { useCallback, useEffect, useState, type ComponentProps, type ComponentType, type FormEvent, type ReactNode } from "react";
import { ClerkAppProvider, useClerkMounted } from "@/components/providers/ClerkAppProvider";
import type { HomeAuthConfig } from "@/components/home/HomeAuthLauncher";
import type {
  AuthIdentifierFlowInner,
  IdentifierFlowResult,
  IdentifierFlowStep,
} from "@/components/auth/AuthIdentifierFlowInner";
import {
  lastIdMethodCookie,
  parseLastIdMethod,
  type HomeAuthMode,
} from "@/lib/modules/config/home-inline-auth";
import type { IdentifierMethod } from "@/lib/modules/auth/identifier-flow";
import { IdentifierField, identifierSubmitLabel } from "@/components/auth/IdentifierField";

type InnerComponent = ComponentType<ComponentProps<typeof AuthIdentifierFlowInner>>;

type Props = {
  config: HomeAuthConfig;
  mode: HomeAuthMode;
  nextUrl: string;
  portalFallbackHref: string;
  onStepChange: (step: IdentifierFlowStep) => void;
  onComplete: (result: IdentifierFlowResult) => void;
  /** معرّف عنوان الحوار — يرثه عنوان خطوة الرمز */
  headingId: string;
  /** وسم «آخر دخول» فوق الحقل */
  badge?: ReactNode;
};

/** تبويبا «رقم الجوال | البريد الإلكتروني» بالوسائل المفعّلة فقط — الجوال أولًا. */
function enabledMethods(config: HomeAuthConfig): IdentifierMethod[] {
  const out: IdentifierMethod[] = [];
  if (config.providers.includes("phone")) out.push("phone");
  if (config.providers.includes("email")) out.push("email");
  return out.length ? out : ["phone"];
}

/**
 * حقل الدخول برمز في الحوار (تبويبا «رقم الجوال | البريد الإلكتروني»). أول رسم بلا Clerk:
 * عند أول تركيز أو كتابة يُركَّب ClerkAppProvider (تحميل ديناميكي) ثم النموذج العربي المضمّن،
 * مع الحفاظ على ما كُتب في كل تبويب وعلى ضغطة «أرسل الرمز» إن سبقت الجاهزية.
 */
export function HomeAuthIdentifier(props: Props) {
  const methods = enabledMethods(props.config);
  const [activated, setActivated] = useState(false);
  const [method, setMethodState] = useState<IdentifierMethod>(methods[0]);
  const [values, setValues] = useState<Record<IdentifierMethod, string>>({ phone: "", email: "" });
  const value = values[method];

  // آخر تبويب مستعمل (كوكي غير حساس) — الجوال افتراضيًا
  useEffect(() => {
    const last = parseLastIdMethod(document.cookie);
    if (last && methods.includes(last)) setMethodState(last);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- عند التركيب فقط
  }, []);

  const setMethod = useCallback((m: IdentifierMethod) => {
    setMethodState(m);
    document.cookie = lastIdMethodCookie(m, window.location.protocol === "https:");
  }, []);
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
          method={method}
          methods={methods}
          onMethodChange={setMethod}
          value={value}
          badge={props.badge}
          busy={queued}
          onValue={(v) => {
            setValues((prev) => ({ ...prev, [method]: v }));
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
            method={method}
            methods={methods}
            onMethodChange={setMethod}
            values={values}
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
  headingId,
  badge,
  method,
  methods,
  onMethodChange,
  values,
  queued,
  onReady,
  onFailed,
}: Props & {
  method: IdentifierMethod;
  methods: IdentifierMethod[];
  onMethodChange: (m: IdentifierMethod) => void;
  values: Record<IdentifierMethod, string>;
  queued: boolean;
  onReady: () => void;
  onFailed: () => void;
}) {
  const mounted = useClerkMounted();
  const [Inner, setInner] = useState<InnerComponent | null>(null);
  // قيم التبويبين لحظة الجاهزية — لا نعيد ضبط النموذج بعدها مع كل حرف
  const [initial, setInitial] = useState<{
    values: Record<IdentifierMethod, string>;
    queued: boolean;
    method: IdentifierMethod;
  } | null>(null);

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
    setInitial({ values, queued, method });
    onReady();
  }, [Inner, initial, values, queued, method, onReady]);

  if (!Inner || !initial) return null;
  return (
    <Inner
      mode={mode}
      nextUrl={nextUrl}
      portalFallbackHref={portalFallbackHref}
      embedded
      onComplete={onComplete}
      onStepChange={onStepChange}
      initialIdentifier={initial.values[initial.method]}
      initialValues={initial.values}
      initialMethod={initial.method}
      identifierMethods={methods}
      onMethodChange={onMethodChange}
      submitOnReady={initial.queued}
      headingId={headingId}
      identifierBadge={badge}
    />
  );
}

/** نسخة خفيفة مطابقة لخطوة المعرّف (الشاشتان ١ و٢) — المكوّن نفسه، بلا Clerk. */
function PlaceholderForm({
  method,
  methods,
  onMethodChange,
  value,
  badge,
  busy,
  onValue,
  onFocus,
  onSubmit,
}: {
  method: IdentifierMethod;
  methods: IdentifierMethod[];
  onMethodChange: (m: IdentifierMethod) => void;
  value: string;
  badge?: ReactNode;
  busy: boolean;
  onValue: (v: string) => void;
  onFocus: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      className="hk-emb__form"
      noValidate
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <IdentifierField
        method={method}
        methods={methods}
        onMethodChange={(m) => {
          onMethodChange(m);
          onFocus();
        }}
        value={value}
        onChange={onValue}
        onFocus={onFocus}
        badge={badge}
      />
      <button type="submit" className="hk-btn-primary" disabled={busy} aria-busy={busy}>
        {busy ? <span className="hk-spinner hk-spinner--light" aria-hidden /> : null}
        <span>{busy ? "لحظة…" : identifierSubmitLabel()}</span>
      </button>
    </form>
  );
}
