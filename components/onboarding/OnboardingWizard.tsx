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
  { id: 3, title: "تأكيد الجوال", reward: CREDIT_REWARDS.onboarding_step_3 },
  { id: 4, title: "الاهتمامات", reward: CREDIT_REWARDS.onboarding_step_4 },
  { id: 5, title: "الموافقات", reward: CREDIT_REWARDS.onboarding_step_5 },
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
  const [step, setStep] = useState(Math.min(5, Math.max(1, initialStep || 1)));
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
        if (typeof p.creditsBalance === "number") setBalance(p.creditsBalance);
        if (p.onboardingCompleted) setDone(true);
        else if (p.onboardingStep > 0) setStep(Math.min(5, p.onboardingStep + 1));
      })
      .catch(() => undefined);
  }, []);

  function toggle(list: string[], value: string, setter: (v: string[]) => void) {
    setter(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  async function submitStep() {
    setError("");
    const payload: Record<string, unknown> = {
      step,
      complete: step === 5,
      phone,
      city,
      entityType,
      yearsExperience,
      specialties,
      interests,
      alertsEnabled,
      phoneVerified,
      termsAccepted,
    };

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "تعذّر حفظ الخطوة.");

      const awarded = Number(data.awarded ?? 0);
      setEarnedThisSession((n) => n + awarded);
      if (typeof data.balance === "number") setBalance(data.balance);

      if (data.done || step === 5) {
        setDone(true);
        return;
      }
      setStep((s) => Math.min(5, s + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ الخطوة.");
    }
  }

  if (done) {
    return (
      <div className="space-y-6 text-center">
        <p className="text-sm font-semibold text-[var(--gold)]">اكتمل ملفك</p>
        <h2 className="font-display text-3xl text-[var(--navy)]">مرحبًا {userName} في حكيم</h2>
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
        <h2 className="font-display text-2xl text-[var(--navy)] sm:text-3xl">أكمل ملفك واكسب المزيد</h2>
        <p className="text-sm leading-7 text-[var(--ink-60)]">
          الخطوة {step} من 5 — رصيدك الآن {balance.toLocaleString("ar-SA")} نقطة
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
        aria-valuemax={5}
      >
        <div
          className="h-full bg-[var(--gold)] transition-all duration-500 ease-out"
          style={{ width: `${(step / 5) * 100}%` }}
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
            رقمك المسجّل: <strong dir="ltr" className="text-[var(--navy)]">{phone || "—"}</strong>
            <br />
            التحقق برسالة OTP سيُفعَّل لاحقًا. أكّد الآن أن الرقم صحيح للمتابعة.
          </p>
          <label className="flex items-start gap-3 text-sm leading-7 text-[var(--navy)]">
            <input
              type="checkbox"
              checked={phoneVerified}
              onChange={(e) => setPhoneVerified(e.target.checked)}
              className="mt-1"
            />
            <span>أؤكد أن رقم الجوال أعلاه صحيح ويمكن التواصل عبره.</span>
          </label>
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
          <p className="rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-3 text-sm leading-7 text-[var(--navy)]">
            عند الإكمال تحصل على +{CREDIT_REWARDS.onboarding_step_5} لهذه الخطوة و+{CREDIT_REWARDS.onboarding_complete}{" "}
            لمكافأة الإكمال الكامل.
          </p>
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
        <GoldButton type="button" disabled={pending} onClick={() => void submitStep()}>
          {pending ? "جارٍ الحفظ…" : step === 5 ? `إنهاء (+${CREDIT_REWARDS.onboarding_step_5})` : `التالي (+${STEPS[step - 1].reward})`}
        </GoldButton>
      </div>
    </div>
  );
}
