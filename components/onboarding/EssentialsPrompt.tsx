"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { GoldButton, LegalAlert } from "@/components/ui/legal";

const PROFESSIONS = [
  { value: "INDIVIDUAL", label: "محامٍ / متدرب" },
  { value: "LAW_FIRM", label: "مكتب محاماة" },
  { value: "OTHER", label: "أخرى (قاضٍ، طالب، مستشار…)" },
] as const;

/**
 * بوابة إلزامية في صدر اللوحة: الاسم + الجوال + المهنة.
 * لا يمكن المتابعة دون حفظ الثلاثة.
 */
export function EssentialsPrompt({
  initialName,
  initialPhone,
  initialProfession,
}: {
  initialName: string;
  initialPhone: string | null;
  initialProfession?: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [profession, setProfession] = useState(initialProfession || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("أدخل الاسم.");
      return;
    }
    if (!phone.trim()) {
      setError("أدخل رقم الجوال.");
      return;
    }
    if (!profession) {
      setError("اختر المهنة.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile/essentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          profession,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحفظ.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="login-page min-h-[70vh]">
      <div aria-hidden className="login-page__glow" />
      <div aria-hidden className="login-page__pattern" />
      <div className="relative z-[1] mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-10">
        <section
          dir="rtl"
          className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[#F9F5EC] p-6 shadow-[var(--sh-sm)] sm:p-8"
          aria-label="بيانات أساسية إلزامية"
        >
          <p className="login-panel__eyebrow">خطوة واحدة قبل البدء</p>
          <h1 className="login-panel__title mt-2">أدخل بياناتك الأساسية</h1>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
            يلزم إدخال <strong>الاسم</strong> و<strong>رقم الجوال</strong> و<strong>المهنة</strong>{" "}
            للمتابعة. يمكنك لاحقًا إكمال باقي الملف إن رغبت بالمكافآت.
          </p>

          <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--navy)]">الاسم</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                autoFocus
                className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[#FFFaf3] px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--navy)]">رقم الجوال</span>
              <input
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="05xxxxxxxx"
                className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[#FFFaf3] px-3 py-2.5 text-left text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-[var(--navy)]">المهنة</span>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value)}
                required
                className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[#FFFaf3] px-3 py-2.5 text-sm"
              >
                <option value="">اختر المهنة</option>
                {PROFESSIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            {error ? <LegalAlert tone="danger">{error}</LegalAlert> : null}

            <GoldButton type="submit" disabled={saving} className="w-full">
              {saving ? "جارٍ الحفظ…" : "حفظ والمتابعة"}
            </GoldButton>
          </form>
        </section>
      </div>
    </div>
  );
}
