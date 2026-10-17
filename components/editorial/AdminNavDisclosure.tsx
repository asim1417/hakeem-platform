"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * طيّ قائمة الإدارة على الجوال (تحت 768) في صفحات المكتب وحدها: زر 44 بـ aria-expanded وaria-controls
 * يسمّي القسم الحالي. من 768 تظهر القائمة كما هي بلا زر. يُستعمل عبر خاصية mobileNavSection في AdminPageShell.
 */
export function AdminNavDisclosure({ section, children }: { section: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mb-4 md:mb-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[0.75rem] border border-[var(--line)] bg-[var(--ivory)] px-4 text-start text-sm font-semibold text-[var(--petrol)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--petrol)] md:hidden"
      >
        <span>
          أقسام الإدارة · <strong>{section}</strong>
        </span>
        <ChevronDown size={20} aria-hidden className={open ? "rotate-180" : undefined} />
      </button>
      <div id={id} className={`${open ? "mt-2 block" : "hidden"} md:mt-0 md:block`}>
        {children}
      </div>
    </div>
  );
}
