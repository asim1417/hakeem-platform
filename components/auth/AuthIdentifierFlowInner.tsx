"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { CodeBoxes } from "@/components/auth/CodeBoxes";
import {
  arabicErrorMessage,
  clerkErrorCode,
  maskIdentifier,
  parseIdentifier,
  pickSecondFactor,
  PROFILE_LABELS,
  profileFieldsToCollect,
  sanitizeCode,
  secondFactorPrompt,
  unsupportedMissingFields,
  type ProfileField,
  type SecondFactorStrategy,
} from "@/lib/modules/auth/identifier-flow";

type SignInRes = NonNullable<ReturnType<typeof useSignIn>["signIn"]>;
type SignUpRes = NonNullable<ReturnType<typeof useSignUp>["signUp"]>;
type Identifier = { kind: "email" | "phone"; value: string };

type Step =
  | { name: "identifier" }
  | { name: "code"; purpose: "sign-in" | "sign-up-primary" | "sign-up-email"; target: Identifier }
  | { name: "second-factor"; strategy: SecondFactorStrategy; canUseBackup: boolean }
  | { name: "profile"; fields: ProfileField[] }
  | { name: "finishing" };

export type IdentifierFlowStep = Step["name"];

/** نتيجة الدخول المضمّن: ok = ثُبّتت hakeem_session، وnext = الوجهة التي يقترحها الخادم. */
export type IdentifierFlowResult = { ok: boolean; next: string };

/** الحقل الذي يُنسب إليه الخطأ — يُعلَّم aria-invalid ويُنقل إليه التركيز. */
type ErrorTarget = "identifier" | "code" | ProfileField;

const RESEND_COOLDOWN_S = 30;
const ERROR_ID = "hakeem-auth-error";
const REQUIRED_NOTE_ID = "hakeem-auth-required";
const CODE_LABEL_ID = "hakeem-code-label";

const cardClass =
  "w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]";
const inputClass =
  "block min-h-[48px] w-full rounded-[0.75rem] border border-[var(--auth-input-border)] bg-white px-4 text-[1rem] text-[#0E3435] transition focus:border-[#0E3435] aria-[invalid=true]:border-[#8C2233]";
const primaryButtonClass =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[0.75rem] bg-[#0E3435] px-4 text-[0.95rem] font-semibold text-[#FFFcf7] transition hover:bg-[#0E3435]/90 disabled:cursor-wait disabled:opacity-70";
const linkButtonClass =
  "inline-flex min-h-[44px] items-center px-1 text-sm font-semibold text-[#8B6914] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50";
const inlineLinkClass = "inline-flex min-h-[44px] items-center underline-offset-2 hover:underline";

function RequiredMark() {
  return (
    <span className="hk-auth-required-mark" aria-hidden>
      *
    </span>
  );
}

function RequiredNote() {
  return (
    <p id={REQUIRED_NOTE_ID} className="hk-auth-required-note">
      الحقول المعلّمة بـ <span aria-hidden>*</span>
      <span className="sr-only">نجمة</span> مطلوبة.
    </p>
  );
}

/**
 * نموذج الدخول العربي بالبريد أو الجوال — Clerk في الخلفية فقط (رموز، تحقق ثنائي، جلسة).
 * رحلة موحّدة: إن لم يوجد حساب يُنشأ تلقائيًا بعد التحقق من الرمز.
 * يُحمَّل ديناميكيًا بعد تركيب ClerkProvider (راجع AuthIdentifierFlow).
 *
 * embedded / onComplete اختياريان (حوار الصفحة الرئيسية). غيابهما = سلوك /auth/identifier كما هو.
 */
export function AuthIdentifierFlowInner({
  mode,
  nextUrl,
  portalFallbackHref,
  embedded = false,
  onComplete,
  onStepChange,
  initialIdentifier = "",
  submitOnReady = false,
}: {
  mode: "sign-in" | "sign-up";
  nextUrl: string;
  /** بوابة Clerk المستضافة — احتياط لحالات لا يغطيها النموذج. */
  portalFallbackHref: string;
  /** عرض مضمّن داخل حوار: بلا بطاقة ولا روابط تنقّل، وخانات رمز منفصلة بتحقق تلقائي. */
  embedded?: boolean;
  /** عند وجوده: تُثبَّت الجلسة في الخلفية ولا يحدث أي انتقال — المستدعي يقرّر. */
  onComplete?: (result: IdentifierFlowResult) => void;
  onStepChange?: (step: IdentifierFlowStep) => void;
  /** قيمة كتبها المستخدم قبل اكتمال التحميل. */
  initialIdentifier?: string;
  /** ضغط «متابعة» قبل جاهزية Clerk ← يُرسل مرة واحدة عند الجاهزية. */
  submitOnReady?: boolean;
}) {
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const clerk = useClerk();
  const ready = signInLoaded && signUpLoaded && Boolean(signIn && signUp);

  const [step, setStep] = useState<Step>({ name: "identifier" });
  const [identifierInput, setIdentifierInput] = useState(initialIdentifier);
  const [code, setCode] = useState("");
  const [profile, setProfile] = useState<Record<ProfileField, string>>({
    first_name: "",
    last_name: "",
    email_address: "",
    username: "",
    password: "",
    legal_accepted: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorTarget, setErrorTarget] = useState<ErrorTarget | null>(null);
  const [errorSeq, setErrorSeq] = useState(0);
  const [notice, setNotice] = useState("");
  const [needsPortal, setNeedsPortal] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [queuedSubmit, setQueuedSubmit] = useState(submitOnReady);
  const resendRef = useRef<(() => Promise<unknown>) | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const identifierRef = useRef<HTMLInputElement>(null);
  const autoSubmittedRef = useRef("");

  const showsCodeBoxes = (s: Step) =>
    embedded && (s.name === "code" || (s.name === "second-factor" && s.strategy !== "backup_code"));

  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setLoadTimedOut(true), 10000);
    return () => window.clearTimeout(id);
  }, [ready]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    onStepChange?.(step.name);
    if ((step.name === "code" || step.name === "second-factor") && !showsCodeBoxes(step)) {
      codeInputRef.current?.focus();
    } else if (step.name === "profile") {
      const first = step.fields.find((f) => f !== "legal_accepted") ?? step.fields[0];
      if (first) document.getElementById(`hakeem-${first}`)?.focus();
    } else if (step.name === "identifier" && embedded) {
      identifierRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- عند تغيّر الخطوة فقط
  }, [step]);

  // الخطأ: التركيز على الحقل المعني (WCAG 3.3.1) — المعرّف aria-describedby يقرأ الرسالة.
  useEffect(() => {
    if (!error || !errorTarget || errorTarget === "code") return;
    if (errorTarget === "identifier") identifierRef.current?.focus();
    else document.getElementById(`hakeem-${errorTarget}`)?.focus();
  }, [error, errorTarget, errorSeq]);

  useEffect(() => {
    if (!error || errorTarget !== "code" || showsCodeBoxes(step)) return;
    codeInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error, errorTarget, errorSeq]);

  function targetForStep(s: Step): ErrorTarget | null {
    if (s.name === "identifier") return "identifier";
    if (s.name === "code" || s.name === "second-factor") return "code";
    if (s.name === "profile") return s.fields[0] ?? null;
    return null;
  }

  function showError(message: string, target: ErrorTarget | null) {
    setError(message);
    setErrorTarget(target);
    setErrorSeq((n) => n + 1);
  }

  function clearError() {
    setError("");
    setErrorTarget(null);
  }

  function fail(err: unknown) {
    showError(arabicErrorMessage(err), targetForStep(step));
  }

  function goToCode(next: Step, resend: () => Promise<unknown>) {
    resendRef.current = resend;
    setCode("");
    autoSubmittedRef.current = "";
    setCooldown(RESEND_COOLDOWN_S);
    setStep(next);
  }

  async function finish(sessionId: string | null) {
    if (!sessionId || !setActive) {
      showError("تعذّر إكمال الدخول. حاول مرة أخرى.", null);
      return;
    }
    setStep({ name: "finishing" });
    await setActive({ session: sessionId });
    await claimAndNavigate();
  }

  /** يثبّت hakeem_session من رمز جلسة Clerk — يعيد الوجهة، أو null إن تعذّر. */
  async function claimSession(): Promise<string | null> {
    try {
      const token = await clerk.session?.getToken();
      if (!token) return null;
      const res = await fetch("/api/auth/claim-clerk-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token, next: nextUrl }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; next?: string } | null;
      return res.ok && data?.ok && data.next ? data.next : null;
    } catch {
      return null;
    }
  }

  /**
   * /auth/continue و/api/auth/me لا يقرآن جلسة Clerk (عزل iPhone)، فنثبّت hakeem_session
   * من رمز الجلسة قبل الانتقال — كما يفعل مسار العودة من بوابة Clerk.
   * مع onComplete: التثبيت في الخلفية بلا انتقال.
   */
  async function claimAndNavigate() {
    const next = await claimSession();
    if (onComplete) {
      onComplete({ ok: Boolean(next), next: next ?? nextUrl });
      return;
    }
    // بلا تثبيت نكمل إلى المسار المحمي مباشرة — clerkMiddleware يقرأ جلسة Clerk هناك
    window.location.assign(next ?? nextUrl);
  }

  // ── الدخول ──

  async function startSignIn(si: SignInRes, id: Identifier) {
    const res = await si.create({ identifier: id.value });
    const wanted = id.kind === "phone" ? "phone_code" : "email_code";
    const factor = res.supportedFirstFactors?.find((f) => f.strategy === wanted);
    if (!factor) {
      showError(arabicErrorMessage({ errors: [{ code: "strategy_for_user_invalid" }] }), "identifier");
      return;
    }
    const prepare = () =>
      "phoneNumberId" in factor
        ? si.prepareFirstFactor({ strategy: "phone_code", phoneNumberId: factor.phoneNumberId })
        : "emailAddressId" in factor
          ? si.prepareFirstFactor({ strategy: "email_code", emailAddressId: factor.emailAddressId })
          : Promise.reject(new Error("unsupported_factor"));
    await prepare();
    goToCode({ name: "code", purpose: "sign-in", target: id }, prepare);
  }

  async function handleSignInResult(si: SignInRes) {
    if (si.status === "complete") return finish(si.createdSessionId);
    if (si.status === "needs_second_factor") {
      const strategy = pickSecondFactor(si.supportedSecondFactors);
      if (!strategy) {
        setNeedsPortal(true);
        showError("يتطلب حسابك وسيلة تحقق إضافية غير متاحة هنا.", null);
        return;
      }
      const canUseBackup = Boolean(si.supportedSecondFactors?.some((f) => f.strategy === "backup_code"));
      const prepare = () =>
        strategy === "phone_code" || strategy === "email_code"
          ? si.prepareSecondFactor({ strategy })
          : Promise.resolve(si);
      await prepare();
      goToCode({ name: "second-factor", strategy, canUseBackup }, prepare);
      return;
    }
    setNeedsPortal(true);
    showError("تعذّر إكمال الدخول بهذه الطريقة.", null);
  }

  // ── إنشاء الحساب ──

  async function startSignUp(su: SignUpRes, id: Identifier) {
    await su.create(id.kind === "phone" ? { phoneNumber: id.value } : { emailAddress: id.value });
    const prepare = () =>
      id.kind === "phone"
        ? su.preparePhoneNumberVerification({ strategy: "phone_code" })
        : su.prepareEmailAddressVerification({ strategy: "email_code" });
    await prepare();
    setNotice("مرحبًا بك في حكيم — سننشئ حسابك بعد تأكيد الرمز.");
    goToCode({ name: "code", purpose: "sign-up-primary", target: id }, prepare);
  }

  async function handleSignUpResult(su: SignUpRes) {
    if (su.status === "complete") return finish(su.createdSessionId);
    if (unsupportedMissingFields(su.missingFields).length > 0) {
      setNeedsPortal(true);
      showError("يتطلب إنشاء الحساب بيانات إضافية غير متاحة هنا.", null);
      return;
    }
    const fields = profileFieldsToCollect(su.missingFields);
    if (fields.length > 0) {
      setNotice("");
      setStep({ name: "profile", fields });
      return;
    }
    if (su.unverifiedFields.includes("email_address") && su.emailAddress) {
      const prepare = () => su.prepareEmailAddressVerification({ strategy: "email_code" });
      await prepare();
      setNotice("");
      goToCode(
        { name: "code", purpose: "sign-up-email", target: { kind: "email", value: su.emailAddress } },
        prepare
      );
      return;
    }
    if (su.unverifiedFields.includes("phone_number") && su.phoneNumber) {
      const prepare = () => su.preparePhoneNumberVerification({ strategy: "phone_code" });
      await prepare();
      goToCode(
        { name: "code", purpose: "sign-up-primary", target: { kind: "phone", value: su.phoneNumber } },
        prepare
      );
      return;
    }
    setNeedsPortal(true);
    showError("تعذّر إكمال إنشاء الحساب بهذه الطريقة.", null);
  }

  // ── الأحداث ──

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    clearError();
    try {
      await action();
    } catch (err) {
      if (clerkErrorCode(err) === "session_exists") {
        setStep({ name: "finishing" });
        await claimAndNavigate();
        return;
      }
      fail(err);
      if (showsCodeBoxes(step)) {
        // رمز خاطئ في الخانات: نفرّغها ليكتب المستخدم الرمز من جديد
        setCode("");
        autoSubmittedRef.current = "";
      }
    } finally {
      setBusy(false);
    }
  }

  function submitIdentifier() {
    const parsed = parseIdentifier(identifierInput);
    if (parsed.kind === "invalid") {
      showError(parsed.message, "identifier");
      return;
    }
    const id: Identifier = parsed;
    void run(async () => {
      if (!signIn || !signUp) return;
      setNotice("");
      try {
        await startSignIn(signIn, id);
      } catch (err) {
        if (clerkErrorCode(err) !== "form_identifier_not_found") throw err;
        await startSignUp(signUp, id);
      }
    });
  }

  function onSubmitIdentifier(e: FormEvent) {
    e.preventDefault();
    if (!ready) {
      // المضمّن: الحقل متاح قبل جاهزية Clerk — التحقق من الصيغة فورًا، والإرسال عند الجاهزية
      if (!embedded) return;
      const parsed = parseIdentifier(identifierInput);
      if (parsed.kind === "invalid") showError(parsed.message, "identifier");
      else setQueuedSubmit(true);
      return;
    }
    submitIdentifier();
  }

  // «متابعة» في الحقل الخفيف قبل التحميل: صيغة خاطئة تظهر فورًا بدل انتظار Clerk
  useEffect(() => {
    if (!queuedSubmit || ready) return;
    const parsed = parseIdentifier(identifierInput);
    if (parsed.kind === "invalid") {
      setQueuedSubmit(false);
      showError(parsed.message, "identifier");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- عند التركيب فقط
  }, []);

  useEffect(() => {
    if (!ready || !queuedSubmit) return;
    setQueuedSubmit(false);
    if (identifierInput.trim()) submitIdentifier();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- إرسال واحد عند الجاهزية
  }, [ready, queuedSubmit]);

  function submitCode(raw: string) {
    const value = sanitizeCode(raw);
    if (value.length < 6) {
      showError("أدخل الرمز كاملًا (6 أرقام).", "code");
      return;
    }
    void run(async () => {
      if (!signIn || !signUp) return;
      if (step.name === "second-factor") {
        const res = await signIn.attemptSecondFactor({ strategy: step.strategy, code: value });
        await handleSignInResult(res);
        return;
      }
      if (step.name !== "code") return;
      if (step.purpose === "sign-in") {
        const strategy = step.target.kind === "phone" ? "phone_code" : "email_code";
        const res = await signIn.attemptFirstFactor({ strategy, code: value });
        await handleSignInResult(res);
        return;
      }
      const res =
        step.target.kind === "phone"
          ? await signUp.attemptPhoneNumberVerification({ code: value })
          : await signUp.attemptEmailAddressVerification({ code: value });
      await handleSignUpResult(res);
    });
  }

  function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    submitCode(code);
  }

  /** الخانات اكتملت: تحقق تلقائي مرة واحدة لكل رمز. */
  function onCodeFilled(value: string) {
    if (busy || autoSubmittedRef.current === value) return;
    autoSubmittedRef.current = value;
    submitCode(value);
  }

  function onResend() {
    if (cooldown > 0 || !resendRef.current) return;
    const resend = resendRef.current;
    void run(async () => {
      await resend();
      setCooldown(RESEND_COOLDOWN_S);
      setCode("");
      autoSubmittedRef.current = "";
      setNotice("أرسلنا رمزًا جديدًا.");
    });
  }

  function onUseBackupCode() {
    setCode("");
    clearError();
    setStep({ name: "second-factor", strategy: "backup_code", canUseBackup: false });
  }

  function onSubmitProfile(e: FormEvent) {
    e.preventDefault();
    if (step.name !== "profile") return;
    for (const f of step.fields) {
      if (f === "legal_accepted" ? profile[f] !== "1" : !profile[f].trim()) {
        showError(
          f === "legal_accepted" ? "يلزم الموافقة على الشروط للمتابعة." : `أكمل حقل «${PROFILE_LABELS[f]}».`,
          f
        );
        return;
      }
    }
    let email = "";
    if (step.fields.includes("email_address")) {
      const parsed = parseIdentifier(profile.email_address);
      if (parsed.kind !== "email") {
        showError("صيغة البريد الإلكتروني غير صحيحة.", "email_address");
        return;
      }
      email = parsed.value;
    }
    const fields = step.fields;
    void run(async () => {
      if (!signUp) return;
      const res = await signUp.update({
        ...(fields.includes("first_name") ? { firstName: profile.first_name.trim() } : {}),
        ...(fields.includes("last_name") ? { lastName: profile.last_name.trim() } : {}),
        ...(email ? { emailAddress: email } : {}),
        ...(fields.includes("username") ? { username: profile.username.trim() } : {}),
        ...(fields.includes("password") ? { password: profile.password } : {}),
        ...(fields.includes("legal_accepted") ? { legalAccepted: true } : {}),
      });
      await handleSignUpResult(res);
    });
  }

  function backToIdentifier() {
    setStep({ name: "identifier" });
    setCode("");
    clearError();
    setNotice("");
    setNeedsPortal(false);
  }

  /** المضمّن: «تعديل الرقم/البريد» — نعود بما كُتب دون فقده. */
  function onEditTarget() {
    if (step.name === "code" && step.purpose === "sign-up-email") {
      setCode("");
      clearError();
      setNotice("");
      setStep({ name: "profile", fields: ["email_address"] });
      return;
    }
    backToIdentifier();
  }

  const invalid = (t: ErrorTarget) => Boolean(error) && errorTarget === t;
  const describedBy = (t: ErrorTarget, extra?: string) =>
    [invalid(t) ? ERROR_ID : "", extra ?? ""].filter(Boolean).join(" ") || undefined;

  // ── العرض ──

  if (!ready && !embedded) {
    return (
      <div className={cardClass} role="status" aria-live="polite">
        <p className="text-center text-sm text-[var(--auth-muted)]">
          {loadTimedOut ? "تأخّر تجهيز الدخول الآمن." : "جارٍ تجهيز الدخول الآمن…"}
        </p>
        {loadTimedOut ? (
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className={primaryButtonClass} onClick={() => window.location.reload()}>
              إعادة المحاولة
            </button>
            <a href={portalFallbackHref} className={`${linkButtonClass} justify-center text-center`}>
              المتابعة عبر صفحة الدخول البديلة
            </a>
          </div>
        ) : null}
      </div>
    );
  }

  const isSignUp = mode === "sign-up";
  let title = isSignUp ? "إنشاء حساب في حكيم" : "الدخول إلى حكيم";
  let subtitle: ReactNode = "أدخل بريدك الإلكتروني أو رقم جوالك، وسنرسل لك رمز تحقق.";
  if (step.name === "code") {
    title = step.purpose === "sign-up-email" ? "تأكيد البريد الإلكتروني" : "أدخل رمز التحقق";
    // bdi: يمنع انقلاب الرقم/البريد داخل النص العربي (RTL).
    subtitle = (
      <>
        أرسلنا رمزًا مكوّنًا من 6 أرقام إلى <bdi dir="ltr">{maskIdentifier(step.target)}</bdi>
      </>
    );
  } else if (step.name === "second-factor") {
    const prompt = secondFactorPrompt(step.strategy);
    title = prompt.title;
    subtitle = prompt.hint;
  } else if (step.name === "profile") {
    title = "أكمل بياناتك";
    subtitle = "خطوة أخيرة لإنشاء حسابك في حكيم.";
  } else if (step.name === "finishing") {
    title = "تم التحقق";
    subtitle = "جارٍ فتح حسابك…";
  }

  const Heading = embedded ? "h3" : "h2";
  const showHeader = !embedded || step.name !== "identifier";
  const isBackup = step.name === "second-factor" && step.strategy === "backup_code";
  const editLabel =
    step.name === "code"
      ? step.target.kind === "phone"
        ? "تعديل الرقم"
        : "تعديل البريد"
      : "تعديل البريد أو الرقم";

  return (
    <div className={embedded ? "w-full" : cardClass} aria-busy={busy || step.name === "finishing"}>
      {showHeader ? (
        <header className="text-center">
          <Heading
            className={`${embedded ? "text-[1.1rem] leading-7" : "text-[1.35rem] leading-8"} font-semibold text-[#0E3435]`}
          >
            {title}
          </Heading>
          <p className="mt-2 text-[0.95rem] leading-7 text-[var(--auth-muted)]">{subtitle}</p>
        </header>
      ) : null}

      {notice && !error ? (
        <p className="mt-4 rounded-[0.5rem] bg-[#F7F2EA] p-3 text-center text-xs font-semibold leading-5 text-[#0E3435]" role="status">
          {notice}
        </p>
      ) : null}

      {error ? (
        <div
          id={ERROR_ID}
          className="mt-4 rounded-[0.5rem] border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold leading-5 text-red-700"
          role="alert"
        >
          {error}
          {needsPortal ? (
            <a href={portalFallbackHref} className={`${inlineLinkClass} mt-1 justify-center underline`}>
              المتابعة عبر صفحة الدخول البديلة
            </a>
          ) : null}
        </div>
      ) : null}

      {embedded && !ready && loadTimedOut ? (
        <div className="mt-4 rounded-[0.5rem] border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold leading-5 text-red-700" role="alert">
          تأخّر تجهيز الدخول الآمن.
          <a href={portalFallbackHref} className={`${inlineLinkClass} justify-center underline`}>
            المتابعة عبر صفحة الدخول البديلة
          </a>
        </div>
      ) : null}

      {step.name === "identifier" ? (
        <form className={`${embedded ? "mt-4" : "mt-6"} flex flex-col gap-3`} onSubmit={onSubmitIdentifier} noValidate>
          <RequiredNote />
          <label htmlFor="hakeem-identifier" className="text-sm font-semibold text-[#0E3435]">
            {embedded ? "البريد أو رقم الجوال" : "البريد الإلكتروني أو رقم الجوال"}
            <RequiredMark />
          </label>
          <input
            ref={identifierRef}
            id="hakeem-identifier"
            className={inputClass}
            dir="ltr"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="05XXXXXXXX أو name@example.com"
            value={identifierInput}
            onChange={(e) => {
              setIdentifierInput(e.target.value);
              if (errorTarget === "identifier") clearError();
            }}
            disabled={busy}
            required
            aria-required="true"
            aria-invalid={invalid("identifier") || undefined}
            aria-describedby={describedBy("identifier", REQUIRED_NOTE_ID)}
          />
          <SubmitButton busy={busy || (queuedSubmit && !ready)}>متابعة</SubmitButton>
        </form>
      ) : null}

      {step.name === "code" || step.name === "second-factor" ? (
        <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmitCode} noValidate>
          <RequiredNote />
          {showsCodeBoxes(step) ? (
            <>
              <p id={CODE_LABEL_ID} className="text-center text-sm font-semibold text-[#0E3435]">
                رمز التحقق
                <RequiredMark />
              </p>
              <CodeBoxes
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (errorTarget === "code" && v.trim()) clearError();
                }}
                onFilled={onCodeFilled}
                labelId={CODE_LABEL_ID}
                describedBy={describedBy("code", REQUIRED_NOTE_ID)}
                invalid={invalid("code")}
                disabled={busy}
                autoFocus
                focusSignal={errorSeq}
              />
              <p className="min-h-[1.5rem] text-center text-sm text-[var(--auth-muted)]" role="status" aria-live="polite">
                {busy ? "جارٍ التحقق من الرمز…" : ""}
              </p>
            </>
          ) : (
            <>
              <label htmlFor="hakeem-code" className="text-sm font-semibold text-[#0E3435]">
                {isBackup ? "الرمز الاحتياطي" : "رمز التحقق"}
                <RequiredMark />
              </label>
              <input
                ref={codeInputRef}
                id="hakeem-code"
                className={`${inputClass} text-center text-[1.4rem] tracking-[0.5em]`}
                dir="ltr"
                type="text"
                inputMode={isBackup ? "text" : "numeric"}
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={isBackup ? 16 : 8}
                placeholder="••••••"
                value={code}
                onChange={(e) => {
                  setCode(isBackup ? e.target.value.trim() : sanitizeCode(e.target.value));
                  if (errorTarget === "code") clearError();
                }}
                disabled={busy}
                required
                aria-required="true"
                aria-invalid={invalid("code") || undefined}
                aria-describedby={describedBy("code", REQUIRED_NOTE_ID)}
              />
              <SubmitButton busy={busy}>تحقق</SubmitButton>
            </>
          )}

          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            {step.name === "code" || step.strategy === "phone_code" || step.strategy === "email_code" ? (
              <button type="button" className={linkButtonClass} onClick={onResend} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ث` : "إعادة إرسال الرمز"}
              </button>
            ) : (
              <span />
            )}
            {step.name === "second-factor" && step.canUseBackup ? (
              <button type="button" className={linkButtonClass} onClick={onUseBackupCode} disabled={busy}>
                استخدام رمز احتياطي
              </button>
            ) : embedded ? (
              <button type="button" className={linkButtonClass} onClick={onEditTarget} disabled={busy}>
                {editLabel}
              </button>
            ) : (
              <button type="button" className={linkButtonClass} onClick={backToIdentifier} disabled={busy}>
                تغيير البريد أو الرقم
              </button>
            )}
          </div>
        </form>
      ) : null}

      {step.name === "profile" ? (
        <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmitProfile} noValidate>
          <RequiredNote />
          {step.fields.map((f) =>
            f === "legal_accepted" ? (
              <label key={f} className="flex min-h-[44px] items-center gap-3 text-sm leading-6 text-[#0E3435]">
                <input
                  id="hakeem-legal_accepted"
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[#0E3435]"
                  checked={profile.legal_accepted === "1"}
                  onChange={(e) => setProfile((p) => ({ ...p, legal_accepted: e.target.checked ? "1" : "" }))}
                  aria-required="true"
                  aria-invalid={invalid(f) || undefined}
                  aria-describedby={describedBy(f)}
                />
                <span>
                  أوافق على{" "}
                  <a href="/terms" className={`${inlineLinkClass} font-semibold`}>
                    شروط الاستخدام
                  </a>{" "}
                  و
                  <a href="/privacy" className={`${inlineLinkClass} font-semibold`}>
                    سياسة الخصوصية
                  </a>
                  <RequiredMark />
                </span>
              </label>
            ) : (
              <div key={f} className="flex flex-col gap-1.5">
                <label htmlFor={`hakeem-${f}`} className="text-sm font-semibold text-[#0E3435]">
                  {PROFILE_LABELS[f]}
                  <RequiredMark />
                </label>
                <input
                  id={`hakeem-${f}`}
                  className={inputClass}
                  dir={f === "first_name" || f === "last_name" ? "rtl" : "ltr"}
                  type={f === "password" ? "password" : f === "email_address" ? "email" : "text"}
                  autoComplete={
                    f === "first_name"
                      ? "given-name"
                      : f === "last_name"
                        ? "family-name"
                        : f === "email_address"
                          ? "email"
                          : f === "password"
                            ? "new-password"
                            : "username"
                  }
                  value={profile[f]}
                  onChange={(e) => {
                    setProfile((p) => ({ ...p, [f]: e.target.value }));
                    if (errorTarget === f) clearError();
                  }}
                  disabled={busy}
                  required
                  aria-required="true"
                  aria-invalid={invalid(f) || undefined}
                  aria-describedby={describedBy(f, REQUIRED_NOTE_ID)}
                />
              </div>
            )
          )}
          <SubmitButton busy={busy}>إنشاء الحساب</SubmitButton>
        </form>
      ) : null}

      {/* نقطة تركيب حماية الروبوتات في Clerk — مطلوبة لنماذج التسجيل المخصّصة. */}
      <div id="clerk-captcha" className="mt-3" />

      {step.name === "identifier" && !embedded ? (
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
      ) : null}

      {step.name !== "finishing" && !embedded ? (
        <p className="mt-4 text-center text-sm">
          <a
            href={`${isSignUp ? "/sign-up" : "/sign-in"}?next=${encodeURIComponent(nextUrl)}`}
            className={`${inlineLinkClass} font-semibold text-[var(--auth-muted)] hover:text-[#0E3435]`}
          >
            العودة إلى خيارات الدخول
          </a>
        </p>
      ) : null}
    </div>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button type="submit" className={primaryButtonClass} disabled={busy} aria-busy={busy}>
      {busy ? (
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#FFFcf7]/30 border-t-[#FFFcf7]"
          aria-hidden
        />
      ) : null}
      <span>{busy ? "لحظة…" : children}</span>
    </button>
  );
}
