"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { GoldButton } from "@/components/ui/legal";

/**
 * بطاقة اختيارية بعد الدخول: الاسم + الجوال فقط.
 * باقي الملف للمكافآت الأفضل — دون إجبار.
 */
export function EssentialsPrompt({
  initialName,
  initialPhone,
  showCreditsHint = true,
}: {
  initialName: string;
  initialPhone: string | null;
  showCreditsHint?: boolean;
}) {
  const [name, setName] = useState(initialName || "");
  const [phone, setPhone] = useState(initialPhone || "");
  const [hidden, setHidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  if (hidden) return null;

  async function dismiss() {
    document.cookie = "hakeem_essentials_dismissed=1; path=/; max-age=2592000; SameSite=Lax";
    setHidden(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/profile/essentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "تعذّر الحفظ.");
      setMsg("تم الحفظ.");
      document.cookie = "hakeem_essentials_dismissed=1; path=/; max-age=2592000; SameSite=Lax";
      window.setTimeout(() => setHidden(true), 700);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "تعذّر الحفظ.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      dir="rtl"
      className="mb-6 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[#F9F5EC] p-5"
      aria-label="بيانات أساسية اختيارية"
    >
      <p className="text-sm font-semibold text-[var(--navy)]">بيانات أساسية (اختيارية)</p>
      <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">
        يكفي الاسم ورقم الجوال للبدء.{" "}
        {showCreditsHint
          ? "إن رغبت بأقصى استفادة من الرصيد والمكافآت، يمكنك لاحقًا إكمال باقي الملف."
          : null}
      </p>

      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void onSubmit(e)}>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--navy)]">الاسم</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[#FFFaf3] px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--navy)]">رقم الجوال</span>
          <input
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="05xxxxxxxx"
            className="focus-ring mt-1 w-full rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[#FFFaf3] px-3 py-2 text-left text-sm"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <GoldButton type="submit" disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </GoldButton>
          <button
            type="button"
            onClick={() => void dismiss()}
            className="text-sm font-semibold text-[var(--ink-60)] underline-offset-4 hover:underline"
          >
            لاحقًا
          </button>
          <Link
            href="/onboarding"
            className="text-sm font-semibold text-[var(--navy)] underline-offset-4 hover:underline"
          >
            إكمال الملف للمكافآت
          </Link>
          {msg ? <span className="text-sm text-[var(--ink-60)]">{msg}</span> : null}
        </div>
      </form>
    </section>
  );
}
