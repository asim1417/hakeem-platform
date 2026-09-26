"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
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

const RESEND_COOLDOWN_S = 30;

const cardClass =
  "w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 shadow-[0_8px_30px_rgba(14,52,53,0.06)]";
const inputClass =
  "block min-h-[48px] w-full rounded-[0.75rem] border border-[rgba(14,52,53,0.18)] bg-white px-4 text-[1rem] text-[#0E3435] outline-none transition focus:border-[#0E3435] focus:ring-2 focus:ring-[#0E3435]/20";
const primaryButtonClass =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[0.75rem] bg-[#0E3435] px-4 text-[0.95rem] font-semibold text-[#FFFcf7] transition hover:bg-[#0E3435]/90 disabled:cursor-wait disabled:opacity-70";
const linkButtonClass =
  "text-sm font-semibold text-[#8B6914] underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50";

/**
 * نموذج الدخول العربي بالبريد أو الجوال — Clerk في الخلفية فقط (رموز، تحقق ثنائي، جلسة).
 * رحلة موحّدة: إن لم يوجد حساب يُنشأ تلقائيًا بعد التحقق من الرمز.
 * يُحمَّل ديناميكيًا بعد تركيب ClerkProvider (راجع AuthIdentifierFlow).
 */
export function AuthIdentifierFlowInner({
  mode,
  nextUrl,
  portalFallbackHref,
}: {
  mode: "sign-in" | "sign-up";
  nextUrl: string;
  /** بوابة Clerk المستضافة — احتياط لحالات لا يغطيها النموذج. */
  portalFallbackHref: string;
}) {
  const { isLoaded: signInLoaded, signIn, setActive } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const clerk = useClerk();
  const ready = signInLoaded && signUpLoaded && Boolean(signIn && signUp);

  const [step, setStep] = useState<Step>({ name: "identifier" });
  const [identifierInput, setIdentifierInput] = useState("");
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
  const [notice, setNotice] = useState("");
  const [needsPortal, setNeedsPortal] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const resendRef = useRef<(() => Promise<unknown>) | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

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
    if (step.name === "code" || step.name === "second-factor") codeInputRef.current?.focus();
  }, [step]);

  function fail(err: unknown) {
    setError(arabicErrorMessage(err));
  }

  function goToCode(next: Step, resend: () => Promise<unknown>) {
    resendRef.current = resend;
    setCode("");
    setCooldown(RESEND_COOLDOWN_S);
    setStep(next);
  }

  async function finish(sessionId: string | null) {
    if (!sessionId || !setActive) {
      setError("تعذّر إكمال الدخول. حاول مرة أخرى.");
      return;
    }
    setStep({ name: "finishing" });
    await setActive({ session: sessionId });
    await claimAndNavigate();
  }

  /**
   * /auth/continue و/api/auth/me لا يقرآن جلسة Clerk (عزل iPhone)، فنثبّت hakeem_session
   * من رمز الجلسة قبل الانتقال — كما يفعل مسار العودة من بوابة Clerk.
   */
  async function claimAndNavigate() {
    try {
      const token = await clerk.session?.getToken();
      if (token) {
        const res = await fetch("/api/auth/claim-clerk-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token, next: nextUrl }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; next?: string } | null;
        if (res.ok && data?.ok && data.next) {
          window.location.assign(data.next);
          return;
        }
      }
    } catch {
      /* نكمل إلى المسار المحمي مباشرة — clerkMiddleware يقرأ جلسة Clerk هناك */
    }
    window.location.assign(nextUrl);
  }

  // ── الدخول ──

  async function startSignIn(si: SignInRes, id: Identifier) {
    const res = await si.create({ identifier: id.value });
    const wanted = id.kind === "phone" ? "phone_code" : "email_code";
    const factor = res.supportedFirstFactors?.find((f) => f.strategy === wanted);
    if (!factor) {
      setError(arabicErrorMessage({ errors: [{ code: "strategy_for_user_invalid" }] }));
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
        setError("يتطلب حسابك وسيلة تحقق إضافية غير متاحة هنا.");
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
    setError("تعذّر إكمال الدخول بهذه الطريقة.");
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
      setError("يتطلب إنشاء الحساب بيانات إضافية غير متاحة هنا.");
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
    setError("تعذّر إكمال إنشاء الحساب بهذه الطريقة.");
  }

  // ── الأحداث ──

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      if (clerkErrorCode(err) === "session_exists") {
        setStep({ name: "finishing" });
        await claimAndNavigate();
        return;
      }
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  function onSubmitIdentifier(e: FormEvent) {
    e.preventDefault();
    const parsed = parseIdentifier(identifierInput);
    if (parsed.kind === "invalid") {
      setError(parsed.message);
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

  function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    const value = sanitizeCode(code);
    if (value.length < 6) {
      setError("أدخل الرمز كاملًا (6 أرقام).");
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

  function onResend() {
    if (cooldown > 0 || !resendRef.current) return;
    const resend = resendRef.current;
    void run(async () => {
      await resend();
      setCooldown(RESEND_COOLDOWN_S);
      setNotice("أرسلنا رمزًا جديدًا.");
    });
  }

  function onUseBackupCode() {
    setCode("");
    setError("");
    setStep({ name: "second-factor", strategy: "backup_code", canUseBackup: false });
  }

  function onSubmitProfile(e: FormEvent) {
    e.preventDefault();
    if (step.name !== "profile") return;
    for (const f of step.fields) {
      if (f === "legal_accepted" ? profile[f] !== "1" : !profile[f].trim()) {
        setError(f === "legal_accepted" ? "يلزم الموافقة على الشروط للمتابعة." : `أكمل حقل «${PROFILE_LABELS[f]}».`);
        return;
      }
    }
    let email = "";
    if (step.fields.includes("email_address")) {
      const parsed = parseIdentifier(profile.email_address);
      if (parsed.kind !== "email") {
        setError("صيغة البريد الإلكتروني غير صحيحة.");
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
    setError("");
    setNotice("");
    setNeedsPortal(false);
  }

  // ── العرض ──

  if (!ready) {
    return (
      <div className={cardClass} role="status" aria-live="polite">
        <p className="text-center text-sm text-[rgba(14,52,53,0.6)]">
          {loadTimedOut ? "تأخّر تجهيز الدخول الآمن." : "جارٍ تجهيز الدخول الآمن…"}
        </p>
        {loadTimedOut ? (
          <div className="mt-4 flex flex-col gap-2">
            <button type="button" className={primaryButtonClass} onClick={() => window.location.reload()}>
              إعادة المحاولة
            </button>
            <a href={portalFallbackHref} className={`${linkButtonClass} text-center`}>
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

  return (
    <div className={cardClass} aria-busy={busy || step.name === "finishing"}>
      <header className="text-center">
        <h2 className="text-[1.35rem] font-semibold leading-8 text-[#0E3435]">{title}</h2>
        <p className="mt-2 text-[0.95rem] leading-7 text-[rgba(14,52,53,0.68)]">{subtitle}</p>
      </header>

      {notice && !error ? (
        <p className="mt-4 rounded-[0.5rem] bg-[#F7F2EA] p-3 text-center text-xs font-semibold leading-5 text-[#0E3435]" role="status">
          {notice}
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[0.5rem] border border-red-200 bg-red-50 p-3 text-center text-xs font-semibold leading-5 text-red-700" role="alert">
          {error}
          {needsPortal ? (
            <a href={portalFallbackHref} className="mt-2 block underline underline-offset-2">
              المتابعة عبر صفحة الدخول البديلة
            </a>
          ) : null}
        </div>
      ) : null}

      {step.name === "identifier" ? (
        <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmitIdentifier} noValidate>
          <label htmlFor="hakeem-identifier" className="text-sm font-semibold text-[#0E3435]">
            البريد الإلكتروني أو رقم الجوال
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
            value={identifierInput}
            onChange={(e) => setIdentifierInput(e.target.value)}
            disabled={busy}
            required
          />
          <SubmitButton busy={busy}>متابعة</SubmitButton>
        </form>
      ) : null}

      {step.name === "code" || step.name === "second-factor" ? (
        <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmitCode} noValidate>
          <label htmlFor="hakeem-code" className="sr-only">
            رمز التحقق
          </label>
          <input
            ref={codeInputRef}
            id="hakeem-code"
            className={`${inputClass} text-center text-[1.4rem] tracking-[0.5em]`}
            dir="ltr"
            type="text"
            inputMode={step.name === "second-factor" && step.strategy === "backup_code" ? "text" : "numeric"}
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={step.name === "second-factor" && step.strategy === "backup_code" ? 16 : 8}
            placeholder="••••••"
            value={code}
            onChange={(e) =>
              setCode(
                step.name === "second-factor" && step.strategy === "backup_code"
                  ? e.target.value.trim()
                  : sanitizeCode(e.target.value)
              )
            }
            disabled={busy}
            required
          />
          <SubmitButton busy={busy}>تحقق</SubmitButton>

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
          {step.fields.map((f) =>
            f === "legal_accepted" ? (
              <label key={f} className="flex items-start gap-2 text-sm leading-6 text-[#0E3435]">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 accent-[#0E3435]"
                  checked={profile.legal_accepted === "1"}
                  onChange={(e) => setProfile((p) => ({ ...p, legal_accepted: e.target.checked ? "1" : "" }))}
                />
                <span>
                  أوافق على{" "}
                  <a href="/terms" className="font-semibold underline-offset-2 hover:underline">
                    شروط الاستخدام
                  </a>{" "}
                  و
                  <a href="/privacy" className="font-semibold underline-offset-2 hover:underline">
                    سياسة الخصوصية
                  </a>
                </span>
              </label>
            ) : (
              <div key={f} className="flex flex-col gap-1.5">
                <label htmlFor={`hakeem-${f}`} className="text-sm font-semibold text-[#0E3435]">
                  {PROFILE_LABELS[f]}
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
                  onChange={(e) => setProfile((p) => ({ ...p, [f]: e.target.value }))}
                  disabled={busy}
                />
              </div>
            )
          )}
          <SubmitButton busy={busy}>إنشاء الحساب</SubmitButton>
        </form>
      ) : null}

      {/* نقطة تركيب حماية الروبوتات في Clerk — مطلوبة لنماذج التسجيل المخصّصة. */}
      <div id="clerk-captcha" className="mt-3" />

      {step.name === "identifier" ? (
        <p className="mt-5 text-center text-xs leading-6 text-[rgba(14,52,53,0.55)]">
          باستمرارك، فإنك توافق على{" "}
          <a href="/terms" className="underline-offset-2 hover:underline">
            شروط الاستخدام
          </a>{" "}
          و
          <a href="/privacy" className="underline-offset-2 hover:underline">
            سياسة الخصوصية
          </a>
          .
        </p>
      ) : null}

      {step.name !== "finishing" ? (
        <p className="mt-4 text-center text-sm">
          <a
            href={`${isSignUp ? "/sign-up" : "/sign-in"}?next=${encodeURIComponent(nextUrl)}`}
            className="font-semibold text-[rgba(14,52,53,0.65)] hover:text-[#0E3435]"
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
