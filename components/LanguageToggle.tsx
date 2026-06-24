"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";

/**
 * مبدّل اللغة (عربي/إنجليزي). يضبط كوكي اللغة ثم يُحدّث الصفحة ليُعاد
 * احتساب الاتجاه (dir) والترجمة من الخادم.
 */
export function LanguageToggle({ current, switchLabel }: { current: "ar" | "en"; switchLabel: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = current === "ar" ? "en" : "ar";

  const onClick = () => {
    // كوكي سنة كاملة، متاح لكل المسارات.
    document.cookie = `hakeem_locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`تبديل اللغة إلى ${switchLabel}`}
      title={switchLabel}
      className="inline-flex h-[38px] items-center gap-1.5 rounded-full border border-[var(--ink-08)] bg-[var(--paper)] px-3 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--gold)] disabled:opacity-50"
    >
      <Languages size={15} aria-hidden />
      {switchLabel}
    </button>
  );
}
