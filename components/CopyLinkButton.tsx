"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/** ينسخ رابط البحث الحالي (مع كل الفلاتر) للمشاركة/الحفظ. */
export function CopyLinkButton({ label = "نسخ رابط البحث" }: { label?: string }) {
  const [done, setDone] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      /* تجاهل */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--ink-20)] bg-white px-2.5 py-0.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--gold)]"
    >
      {done ? <Check size={13} className="text-[var(--emerald)]" aria-hidden /> : <Link2 size={13} aria-hidden />}
      {done ? "تم النسخ" : label}
    </button>
  );
}
