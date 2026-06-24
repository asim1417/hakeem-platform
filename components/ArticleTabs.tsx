"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export type ArticleTab = { id: string; label: string; badge?: number; content: ReactNode };

/**
 * حاوية تبويبات منظّمة لأقسام صفحة المادة (شرح/أحكام/فقه/سجل…).
 * تستقبل محتوى مُصيَّرًا من الخادم وتدير التبديل في العميل، متاحة بلوحة المفاتيح.
 */
export function ArticleTabs({ tabs }: { tabs: ArticleTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  if (!current) return null;

  return (
    <div className="rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--paper)] shadow-[var(--sh-xs)]">
      <div role="tablist" aria-label="أقسام المادة" className="flex flex-wrap gap-1 border-b border-[var(--ink-08)] p-2">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-[var(--r-md)] px-3 py-1.5 text-sm font-semibold transition ${
                on ? "bg-[var(--navy)] text-white" : "text-[var(--ink-80)] hover:bg-[var(--gold-ghost)] hover:text-[var(--navy)]"
              }`}
            >
              {t.label}
              {typeof t.badge === "number" && t.badge > 0 ? (
                <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${on ? "bg-white/20" : "bg-[var(--ink-08)] text-[var(--ink-60)]"}`}>
                  {t.badge.toLocaleString("ar-SA")}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="p-4">
        {current.content}
      </div>
    </div>
  );
}
