"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CITY_OPTIONS,
  CREDIT_REWARDS,
  SPECIALTY_OPTIONS,
  YEARS_OPTIONS,
} from "@/config/credits";
import { GoldButton, LegalAlert, NavyButton } from "@/components/ui/legal";

const STEPS = [
  { id: 1, title: "البيانات الأساسية", reward: CREDIT_REWARDS.onboarding_step_1 },
  { id: 2, title: "الخلفية المهنية", reward: CREDIT_REWARDS.onboarding_step_2 },
  { id: 3, title: "تحقق الجوال", reward: CREDIT_REWARDS.onboarding_step_3 },
  { id: 4, title: "الاهتمامات", reward: CREDIT_REWARDS.onboarding_step_4 },
  { id: 5, title: "الصورة والشهادات", reward: CREDIT_REWARDS.onboarding_step_5 },
  { id: 6, title: "الموافقات", reward: CREDIT_REWARDS.onboarding_step_6 },
] as const;

type Entity = "INDIVIDUAL" | "LAW_FIRM" | "OTHER";

export function OnboardingWizard({
  userName,
  initialStep = 1,
  initialBalance = 0,
}: {
  userName: string;
  initialStep?: number;
  initialBalance?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(6, Math.max(1, initialStep || 1)));
  const [balance, setBalance] = useState(initialBalance);
  const [earnedThisSession, setEarnedThisSession] = useState(0);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [entityType, setEntityType] = useState<Entity>("INDIVIDUAL");
  const [yearsExperience, setYearsExperience] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [previewCode, setPreviewCode] = useState("");
  const [certificates, setCertificates] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [otpHint, setOtpHint] = useState("");

  useEffect(() => {
    void fetch("/api/onboarding")
      .then((r) => r.json())
      .then((data) => {
        const p = data?.profile;
        if (!p) return;
        if (p.phone) setPhone(p.phone);
        if (p.city) setCity(p.city);
        if (p.entityType) setEntityType(p.entityType);
        if (p.yearsExperience) setYearsExperience(p.yearsExperience);
        if (Array.isArray(p.specialties)) setSpecialties(p.specialties);
        if (Array.isArray(p.interests)) setInterests(p.interests);
        if (typeof p.alertsEnabled === "boolean") setAlertsEnabled(p.alertsEnabled);
        if (p.phoneVerified) setPhoneVerified(true);
        if (p.termsAccepted) setTermsAccepted(true);
        if (Array.isArray(p.certificates)) setCertificates(p.certificates.join("\n"));
        if (typeof p.creditsBalance === "number") setBalance(p.creditsBalance);
        if (p.onboardingCompleted) setDone(true);
        else if (p.onboardingStep > 0) setStep(Math.min(6, p.onboardingStep + 1));
      })
      .catch(() => undefined);
  }, []);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function sendOtp() {
    setError("");
    setOtpHint("");
    const res = await fetch("/api/otp/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "issue", phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? "تعذّر إرسال الرمز.");
    setOtpHint(data.message || "تم الإرسال.");
    if (data.previewCode) setPreviewCode(data.previewCode);
  }

  async function confirmOtp() {
    setError("");
    const res = await fetch("/api/otp/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", code: otpCode }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? "رمز غير صحيح.");
    setPhoneVerified(true);
    setOtpHint(data.message || "تم التحقق.");
  }

  async function uploadAvatar() {
    if (!avatarFile && !certificates.trim()) return 0;
    const fd = new FormData();
    if (avatarFile) fd.append("file", avatarFile);
    if (certificates.trim()) fd.append("certificates", certificates);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? "تعذّر رفع الصورة.");
    if (typeof data.balance === "number") setBalance(data.balance);
    return Number(data.awarded ?? 0);
  }

  async function submitStep(opts?: { skipAvatar?: boolean }) {
    setError("");
    try {
      if (step === 3 && !phoneVerified) {
        // الجوال اختياري — السعودية مقفلة في Clerk SMS افتراضيًا
      }

      let avatarAwarded = 0;
      if (step === 5 && !opts?.skipAvatar) {
        avatarAwarded = await uploadAvatar();
      }

      const payload: Record<string, unknown> = {
        step,
        complete: step === 6,
        phone,
        city,
        entityType,
        yearsExperience,
        specialties,
        interests,
        alertsEnabled,
        phoneVerified,
        termsAccepted,
        certificates: certificates
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean),
        skipAvatar: opts?.skipAvatar === true,
      };

      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "تعذّر حفظ الخطوة.");

      const awarded = Number(data.awarded ?? 0) + avatarAwarded;
      setEarnedThisSession((n) => n + awarded);
      if (typeof data.balance === "number") setBalance(data.balance);

      if (data.done || step === 6) {
        setDone(true);
        return;
      }
      setStep((s) => Math.min(6, s + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الخطوة.");
    }
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-sm font-semibold text-[var(--gold)]">اكتمل ملفك</p>
        <h2 className="font-display-ar text-3xl text-[var(--navy)]">مرحبًا {userName} في حكيم</h2>
        <p className="text-sm leading-7 text-[var(--ink-60)]">
          رصيدك الحالي <strong className="text-[var(--navy)]">{balance.toLocaleString("ar-SA")}</strong> نقطة
          {earnedThisSession > 0 ? ` (+${earnedThisSession.toLocaleString("ar-SA")} في هذه الجلسة)` : ""}.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <NavyButton type="button" onClick={() => startTransition(() => router.push("/dashboard?welcome=1"))}>
            الذهاب إلى لوحتي
          </NavyButton>
          <Link href="/dashboard/ask" className="text-sm font-semibold text-[var(--navy)] underline-offset-4 hover:underline">
            ابدأ استشارة
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-[var(--gold)]">إكمال الملف · +{CREDIT_REWARDS.welcome} نقطة ترحيبية</p>
        <h2 className="font-display-ar text-2xl text-[var(--navy)] sm:text-3xl">أكمل ملفك واكسب المزيد</h2>
        <p className="text-sm leading-7 text-[var(--ink-60)]">
          الخطوة {step} من 6 — رصيدك الآن {balance.toLocaleString("ar-SA")} نقطة
        </p>
      </header>

      <ol className="flex flex-wrap gap-2" aria-label="خطوات الإكمال">
        {STEPS.map((s) => (
          <li
            key={s.id}
            className={`rounded-[var(--r-md)] px-3 py-1.5 text-xs font-semibold ${
              s.id === step
                ? "bg-[var(--navy)] text-white"
                : s.id < step
                  ? "bg-[var(--gold-ghost)] text-[var(--navy)]"
                  : "border border-[var(--gold-border)] text-[var(--ink-40)]"
            }`}
          >
            {s.id}. {s.title}
          </li>
        ))}
      </ol>

      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--gold-border)]"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={6}
      >
        <div
          className="h-full bg-[var(--gold)] transition-all duration-500 ease-out"
          style={{ width: `${(step / 6) * 100}%` }}
        />
      </div>

      {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}

      {step === 1 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">رقم الجوال</span>
            <input
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
              className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 text-left"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">المدينة</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3"
            >
              <option value="">اختر المدينة</option>
              {CITY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">نوع الكيان</span>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as Entity)}
              className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3"
            >
              <option value="INDIVIDUAL">محامٍ فرد / متدرب</option>
              <option value="LAW_FIRM">مكتب محاماة</option>
              <option value="OTHER">أخرى</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">سنوات الخبرة</span>
            <select
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3"
            >
              <option value="">اختر</option>
              {YEARS_OPTIONS.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-semibold text-[var(--navy)]">التخصصات القانونية</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((s) => {
                const on = specialties.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(specialties, s, setSpecialties)}
                    className={`focus-ring rounded-[var(--r-md)] border px-3 py-2 text-sm transition ${
                      on
                        ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                        : "border-[var(--gold-border)] bg-ivory text-[var(--navy)] hover:bg-[var(--gold-ghost)]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm leading-7 text-[var(--ink-60)]">
            رقمك: <strong dir="ltr" className="text-[var(--navy)]">{phone || "—"}</strong>
          </p>
          <p className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-3 text-sm leading-7 text-[var(--navy)]">
            التحقق بالجوال اختياري حاليًا. إن تعذّر OTP للسعودية من Clerk، يمكنك التخطّي والمتابعة لإكمال الملف والنقاط.
          </p>
          {phoneVerified ? (
            <LegalAlert tone="success">تم التحقق من الجوال بنجاح.</LegalAlert>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <NavyButton type="button" onClick={() => void sendOtp().catch((e) => setError(e.message))}>
                  إرسال رمز OTP
                </NavyButton>
              </div>
              {otpHint ? <p className="text-sm text-[var(--ink-60)]">{otpHint}</p> : null}
              {previewCode ? (
                <p className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-sm text-[var(--navy)]">
                  رمز التطوير: <strong dir="ltr">{previewCode}</strong>
                </p>
              ) : null}
              <label className="block">
                <span className="text-sm font-semibold text-[var(--navy)]">أدخل الرمز</span>
                <input
                  dir="ltr"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  maxLength={6}
                  placeholder="000000"
                  className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3 text-left tracking-widest"
                />
              </label>
              <GoldButton type="button" onClick={() => void confirmOtp().catch((e) => setError(e.message))}>
                تأكيد الرمز
              </GoldButton>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <fieldset>
            <legend className="text-sm font-semibold text-[var(--navy)]">اختر 3 اهتمامات على الأقل</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {SPECIALTY_OPTIONS.map((s) => {
                const on = interests.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(interests, s, setInterests)}
                    className={`focus-ring rounded-[var(--r-md)] border px-3 py-2 text-sm transition ${
                      on
                        ? "border-[var(--gold)] bg-[var(--gold-ghost)] text-[var(--navy)]"
                        : "border-[var(--gold-border)] bg-ivory text-[var(--navy)]"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <label className="flex items-start gap-3 text-sm leading-7 text-[var(--navy)]">
            <input
              type="checkbox"
              checked={alertsEnabled}
              onChange={(e) => setAlertsEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>أريد تنبيهات بتحديثات الأنظمة في تخصصاتي.</span>
          </label>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">صورة الملف (اختياري)</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
              className="mt-2 block w-full text-sm"
            />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-[var(--navy)]">شهادات مهنية (سطر لكل شهادة)</span>
            <textarea
              value={certificates}
              onChange={(e) => setCertificates(e.target.value)}
              rows={3}
              placeholder="مثال: رخصة محاماة — رقم …"
              className="focus-ring mt-2 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-3"
            />
          </label>
          <p className="text-xs text-[var(--ink-40)]">يمكنك التخطي — مكافأة +{CREDIT_REWARDS.onboarding_step_5} عند الرفع.</p>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4">
          <label className="flex items-start gap-3 text-sm leading-7 text-[var(--navy)]">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1"
            />
            <span>
              أوافق على{" "}
              <Link href="/terms" className="underline underline-offset-4" target="_blank">
                الشروط
              </Link>{" "}
              و{" "}
              <Link href="/privacy" className="underline underline-offset-4" target="_blank">
                سياسة الخصوصية
              </Link>
              .
            </span>
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <button
          type="button"
          disabled={step <= 1 || pending}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className="focus-ring text-sm font-semibold text-[var(--ink-60)] disabled:opacity-40"
        >
          السابق
        </button>
        <div className="flex flex-wrap gap-2">
          {step === 3 && !phoneVerified ? (
            <button
              type="button"
              className="focus-ring text-sm font-semibold text-[var(--ink-60)]"
              onClick={() => void submitStep()}
            >
              تخطّي التحقق
            </button>
          ) : null}
          {step === 5 ? (
            <button
              type="button"
              className="focus-ring text-sm font-semibold text-[var(--ink-60)]"
              onClick={() => void submitStep({ skipAvatar: true })}
            >
              تخطّي
            </button>
          ) : null}
          <GoldButton type="button" disabled={pending} onClick={() => void submitStep()}>
            {pending
              ? "جارٍ الحفظ…"
              : step === 6
                ? `إنهاء (+${CREDIT_REWARDS.onboarding_step_6})`
                : `التالي (+${STEPS[step - 1].reward})`}
          </GoldButton>
        </div>
      </div>
    </div>
  );
}
