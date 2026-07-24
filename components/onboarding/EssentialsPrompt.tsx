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
 * بوابة إلزامية داخل لوحة حكيم (ليست شاشة دخول منفصلة):
 * الاسم + الجوال + المهنة قبل فتح المحتوى الإفتراضي.
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
    <div className="essentials-gate mx-auto max-w-xl py-4 sm:py-8">
      <p className="text-sm font-semibold text-[var(--gold-dark)]">استكمال ملفك في حكيم</p>
      <h1 className="mt-2 font-display-ar text-2xl font-bold text-[var(--navy)] sm:text-3xl">
        خطوة قصيرة قبل المتابعة
      </h1>
      <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
        أنت داخل المنصة. يلزم إدخال <strong>الاسم</strong> و<strong>رقم الجوال</strong> و
        <strong>المهنة</strong> لفتح أدوات العمل — الشريط الجانبي والتنقّل يبقيان معك.
      </p>

      <section
        dir="rtl"
        className="mt-6 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 sm:p-7"
        aria-label="استكمال البيانات الأساسية"
      >
        <ol className="mb-5 flex flex-wrap gap-2 text-xs font-semibold text-[var(--ink-60)]">
          <li className="rounded-md bg-[var(--navy)] px-2.5 py-1 text-white">1 · بيانات أساسية</li>
          <li className="rounded-md border border-[var(--ink-08)] bg-white px-2.5 py-1">
            2 · لوحة العمل
          </li>
        </ol>

        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
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

          <GoldButton type="submit" disabled={saving} className="w-full min-h-[44px]">
            {saving ? "جارٍ الحفظ…" : "حفظ والمتابعة إلى لوحة العمل"}
          </GoldButton>
        </form>
      </section>
    </div>
  );
}
